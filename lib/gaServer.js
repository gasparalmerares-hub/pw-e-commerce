// Google Analytics 4 — compra desde el servidor (Measurement Protocol), la
// contraparte de lib/metaConversions.js y lib/tiktokEvents.js. Se llama en
// los mismos dos lugares (webhook de Mercado Pago y pedido marcado "pagado"
// en el panel), así GA cuenta también las transferencias y los pagos de MP
// donde el cliente no volvió a la web. Usa el id del pedido como
// transaction_id, que es lo que GA usa para no contar dos veces la misma
// compra cuando también la manda el navegador.
//
// No-op si falta GA_API_SECRET (GA → Administrar → Flujos de datos → web →
// Secretos de la API de Measurement Protocol).

import crypto from "crypto";
import { leerAtribucion } from "@/lib/metaAtribucion";
import { supabaseAdmin } from "@/lib/supabase";
import { esPedidoMayorista } from "@/lib/mayorista";
import { GA_ID } from "@/lib/ga";

// Cookie _ga "GA1.1.123456789.1700000000" → client_id "123456789.1700000000"
function clientIdDesdeCookie(ga) {
  const m = String(ga ?? "").match(/^GA\d\.\d\.(\d+\.\d+)$/);
  return m ? m[1] : null;
}

// Cookie _ga_<ID>: formato viejo "GS1.1.1700000000.1..." o nuevo "GS2.1.s1700000000$o1..."
function sessionIdDesdeCookie(gas) {
  const s = String(gas ?? "");
  const nuevo = s.match(/^GS2\.\d\.s(\d+)/);
  if (nuevo) return nuevo[1];
  const viejo = s.match(/^GS1\.\d\.(\d+)\./);
  return viejo ? viejo[1] : null;
}

// Mismo criterio que Meta y TikTok: las mayoristas solo si se activó en
// Admin → Configuración (meta_mayoristas = "si").
async function mayoristasActivado() {
  try {
    const { data } = await supabaseAdmin().from("configuracion").select("valor").eq("clave", "meta_mayoristas").maybeSingle();
    return data?.valor === "si";
  } catch {
    return false;
  }
}

export async function enviarGA(evento, { clientId, sessionId } = {}) {
  const SECRET = process.env.GA_API_SECRET;
  if (!SECRET) return { ok: false, motivo: "Falta GA_API_SECRET" };
  const params = { engagement_time_msec: 1, ...evento.params, ...(sessionId ? { session_id: sessionId } : {}) };
  const res = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${GA_ID}&api_secret=${SECRET}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Sin cookie _ga (navegador que la bloqueó) la compra igual se cuenta,
        // con un visitante nuevo y sin saber de dónde vino.
        client_id: clientId || `${crypto.randomInt(1e9)}.${Math.floor(Date.now() / 1000)}`,
        events: [{ name: evento.name, params }],
      }),
    }
  );
  return { ok: res.ok, status: res.status };
}

export async function sendGAPurchase(pedido) {
  if (!process.env.GA_API_SECRET || !pedido) return;
  if (esPedidoMayorista(pedido) && !(await mayoristasActivado())) {
    console.log("[ga-server] Pedido mayorista no informado —", pedido.id);
    return;
  }

  const items = (Array.isArray(pedido.items) ? pedido.items : []).filter((i) => i.id !== "envio" && i.id !== "estampa");
  const attr = leerAtribucion(pedido.observaciones);

  try {
    const r = await enviarGA(
      {
        name: "purchase",
        params: {
          currency: "ARS",
          value: Number(pedido.total) || 0,
          transaction_id: String(pedido.id),
          items: items.map((i) => ({
            item_id: String(i.id),
            item_name: i.nombre,
            ...(i.talle ? { item_variant: String(i.talle) } : {}),
            price: Number(i.precio) || 0,
            quantity: Number(i.cantidad) || 1,
          })),
        },
      },
      { clientId: clientIdDesdeCookie(attr?.ga), sessionId: sessionIdDesdeCookie(attr?.gas) }
    );
    if (r.ok) console.log("[ga-server] purchase enviado — pedido", pedido.id);
    else console.error("[ga-server] error:", r.status ?? r.motivo);
  } catch (e) {
    console.error("[ga-server] excepción:", e?.message ?? e);
  }
}
