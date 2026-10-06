// TikTok Events API (server-side) — la contraparte de lib/metaConversions.js.
// Envía CompletePayment cuando un pedido se confirma como pagado (webhook de
// Mercado Pago o pedido marcado "pagado" en el panel), así TikTok cuenta
// también las transferencias y los pagos de MP donde el cliente no volvió a
// la web. Usa el mismo event_id que el píxel del navegador (id del pedido)
// para que TikTok no cuente la compra dos veces.
//
// No-op si falta TIKTOK_EVENTS_TOKEN (token de Events Manager → píxel →
// Configuración → Events API).

import crypto from "crypto";
import { leerAtribucion } from "@/lib/metaAtribucion";
import { supabaseAdmin } from "@/lib/supabase";
import { esPedidoMayorista } from "@/lib/mayorista";
import { TT_PIXEL_ID } from "@/lib/ttpixel";

function sha256(value) {
  if (!value) return null;
  return crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex");
}

// TikTok pide el teléfono en formato E.164 (+54...) antes de hashearlo
function hashTelefono(value) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (!digits.startsWith("54")) digits = "54" + digits.replace(/^0/, "");
  return crypto.createHash("sha256").update("+" + digits).digest("hex");
}

// Mismo criterio que Meta: las ventas mayoristas se informan solo si se
// activó en Admin → Configuración (meta_mayoristas = "si").
async function mayoristasActivado() {
  try {
    const { data } = await supabaseAdmin().from("configuracion").select("valor").eq("clave", "meta_mayoristas").maybeSingle();
    return data?.valor === "si";
  } catch {
    return false;
  }
}

export async function sendTikTokPurchase(pedido) {
  const TOKEN = process.env.TIKTOK_EVENTS_TOKEN;
  if (!TOKEN || !TT_PIXEL_ID || !pedido) return;
  if (esPedidoMayorista(pedido) && !(await mayoristasActivado())) {
    console.log("[tiktok-events] Pedido mayorista no informado —", pedido.id);
    return;
  }

  const items = Array.isArray(pedido.items) ? pedido.items : [];
  const productos = items.filter((i) => i.id !== "envio" && i.id !== "estampa");
  const baseUrl = (process.env.NEXT_PUBLIC_URL ?? "https://camisetaszeus.com").replace(/\/$/, "");

  const user = { external_id: sha256(pedido.id) };
  const email = sha256(pedido.email);
  const telefono = hashTelefono(pedido.telefono);
  if (email) user.email = email;
  if (telefono) user.phone = telefono;

  // Cookie del píxel (_ttp), id del clic en el anuncio (ttclid), navegador e
  // IP capturados al crear el pedido: sin esto TikTok no puede vincular la
  // compra con el anuncio que la generó.
  const attr = leerAtribucion(pedido.observaciones);
  if (attr?.ttp)    user.ttp = attr.ttp;
  if (attr?.ttclid) user.ttclid = attr.ttclid;
  if (attr?.ua)     user.user_agent = attr.ua;
  if (attr?.ip)     user.ip = attr.ip;

  const payload = {
    event_source: "web",
    event_source_id: TT_PIXEL_ID,
    data: [
      {
        event: "CompletePayment",
        event_time: Math.floor(Date.now() / 1000),
        event_id: String(pedido.id),
        user,
        page: { url: `${baseUrl}/checkout/exito` },
        properties: {
          currency: "ARS",
          value: Number(pedido.total) || 0,
          content_type: "product",
          order_id: String(pedido.id),
          contents: productos.map((i) => ({
            content_id: String(i.id),
            content_name: i.nombre,
            quantity: Number(i.cantidad) || 1,
            price: Number(i.precio) || 0,
          })),
        },
      },
    ],
  };

  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || json?.code !== 0) {
      console.error("[tiktok-events] error:", res.status, JSON.stringify(json).slice(0, 300));
    } else {
      console.log("[tiktok-events] CompletePayment enviado — pedido", pedido.id);
    }
  } catch (e) {
    console.error("[tiktok-events] excepción:", e?.message ?? e);
  }
}
