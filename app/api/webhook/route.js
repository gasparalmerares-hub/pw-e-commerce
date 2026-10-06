import { supabaseAdmin } from "@/lib/supabase";
import { sendPurchaseEvent } from "@/lib/metaConversions";
import { sendTikTokPurchase } from "@/lib/tiktokEvents";
import { enviarConfirmacionPago } from "@/lib/emailConfirmacion";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Reconstruye el pedido a partir de los datos que manda MercadoPago.
// Se usa cuando llega un pago aprobado y el pedido no está en la base
// (por ejemplo, si se borró del panel mientras estaba pendiente). Así
// una venta cobrada nunca queda sin registrar.
async function recrearPedidoDesdeMP(db, payment, paymentId, ref) {
  const ai      = payment.additional_info ?? {};
  const payerAi = ai.payer ?? {};
  const dir     = payerAi.address ?? {};

  const items = (ai.items ?? [])
    .filter((i) => i.id !== "envio" && i.id !== "estampa")
    .map((i) => {
      const titulo = String(i.title ?? "");
      const [nombre, talle] = titulo.split(" - Talle ");
      return {
        id: String(i.id),
        nombre: (nombre ?? titulo).trim(),
        talle: (talle ?? "").trim(),
        precio: Number(i.unit_price) || 0,
        cantidad: Number(i.quantity) || 1,
      };
    });

  const nombre = [payerAi.first_name, payerAi.last_name].filter(Boolean).join(" ").trim();
  const tel = payerAi.phone?.number
    ? `${payerAi.phone.area_code ?? ""}${payerAi.phone.number}`
    : "";

  const fila = {
    nombre:        nombre || "(recuperado de MercadoPago)",
    email:         payment.payer?.email ?? "",
    telefono:      tel,
    provincia:     "",
    localidad:     "",
    calle:         dir.street_name ?? "",
    numero:        dir.street_number != null ? String(dir.street_number) : "",
    piso:          "",
    departamento:  "",
    codigo_postal: dir.zip_code ?? "",
    observaciones: "[RECUPERADO] El pedido no estaba en la base y se reconstruyó con los datos de MercadoPago. Confirmá la dirección con el cliente antes de despachar.",
    items,
    total:            Number(payment.transaction_amount) || 0,
    estado:           "pagado",
    metodo_pago:      "mercadopago",
    payment_id:       String(paymentId),
    stock_descontado: true,
  };
  // Conservamos el id original para poder rastrearlo contra MercadoPago
  if (ref && UUID_RE.test(ref)) fila.id = ref;

  const { data, error } = await db.from("pedidos").insert(fila).select("*").single();
  if (error) {
    console.error("[webhook] No se pudo recrear el pedido:", error.message);
    return null;
  }
  return data;
}

export async function POST(request) {
  noStore();
  try {
    const { type, data } = await request.json();

    if (type !== "payment") return Response.json({ received: true });

    const paymentId = data?.id;
    if (!paymentId) return Response.json({ received: true });

    // Verificar estado del pago con MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (payment.status !== "approved") return Response.json({ received: true });

    const db  = supabaseAdmin();
    const ref = payment.external_reference;

    // 1. Buscar el pedido: primero por su id, después por payment_id
    //    (esto último cubre reintentos del webhook).
    let pedido = null;
    if (ref) {
      const { data: p } = await db.from("pedidos").select("*").eq("id", ref).maybeSingle();
      pedido = p ?? null;
    }
    if (!pedido) {
      const { data: p } = await db
        .from("pedidos")
        .select("*")
        .eq("payment_id", String(paymentId))
        .maybeSingle();
      pedido = p ?? null;
    }

    // 2. Idempotencia: MercadoPago puede notificar varias veces el mismo pago.
    //    Si ya lo procesamos, no volvemos a descontar stock ni a mandar mail.
    if (pedido && pedido.stock_descontado && String(pedido.payment_id) === String(paymentId)) {
      console.log(`[webhook] Pago ${paymentId} ya procesado — skip`);
      return Response.json({ received: true });
    }

    // 3. Si el pedido no existe, lo reconstruimos con los datos de MercadoPago
    if (!pedido) {
      pedido = await recrearPedidoDesdeMP(db, payment, paymentId, ref);
      if (!pedido) return Response.json({ received: true });
      console.warn(`[webhook] Pedido ausente — recreado desde MercadoPago (pago ${paymentId})`);
    } else {
      await db
        .from("pedidos")
        .update({ estado: "pagado", payment_id: String(paymentId), stock_descontado: true })
        .eq("id", pedido.id);
    }

    // 4. Purchase server-side a Meta (deduplica con el pixel del navegador
    //    por event_id = pedido.id). Lo mismo para TikTok.
    await sendPurchaseEvent(pedido);
    await sendTikTokPurchase(pedido);

    // 5. Descontar stock. Solo aplica a productos_stock: el catálogo y niños
    //    son por encargo y no manejan stock real.
    for (const item of pedido.items ?? []) {
      if (!item.id || item.id === "envio" || item.id === "estampa") continue;
      if (item.tabla && item.tabla !== "productos_stock") continue;
      const cantidad = Number(item.cantidad ?? 1);

      const { data: prod } = await db
        .from("productos_stock")
        .select("stock, stock_por_talle")
        .eq("id", String(item.id))
        .maybeSingle();

      if (!prod) continue;

      const updates = { stock: Math.max(0, (prod.stock ?? 0) - cantidad) };

      const talle = item.talle ?? "";
      if (talle && prod.stock_por_talle?.[talle] !== undefined) {
        updates.stock_por_talle = {
          ...prod.stock_por_talle,
          [talle]: Math.max(0, prod.stock_por_talle[talle] - cantidad),
        };
      }

      await db.from("productos_stock").update(updates).eq("id", String(item.id));
    }

    // 6. Email de confirmación al comprador
    await enviarConfirmacionPago(pedido);

    console.log(`Pago aprobado ${paymentId} — pedido ${pedido.id}`);
    return Response.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return Response.json({ error: "Webhook error" }, { status: 500 });
  }
}
