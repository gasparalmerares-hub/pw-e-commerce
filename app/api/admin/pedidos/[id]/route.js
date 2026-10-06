import { supabaseAdmin } from "@/lib/supabase";
import { sendPurchaseEvent } from "@/lib/metaConversions";
import { sendTikTokPurchase } from "@/lib/tiktokEvents";
import { enviarConfirmacionPago } from "@/lib/emailConfirmacion";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ESTADOS_VALIDOS = ["pendiente", "pagado", "enviado", "entregado", "cancelado"];

// Descuenta el stock de cada item del pedido (global y por talle/color).
// Misma lógica que el webhook de MercadoPago.
async function descontarStock(items) {
  for (const item of items ?? []) {
    if (!item.id || item.id === "envio" || item.id === "estampa") continue;
    // Solo se descuenta stock de la sección "Stock". El catálogo es por
    // encargo (sin stock real), así que esos items se ignoran.
    if (item.tabla && item.tabla !== "productos_stock") continue;
    const cantidad = Number(item.cantidad ?? 1);

    const { data: prod } = await supabaseAdmin()
      .from("productos_stock")
      .select("stock, stock_por_talle")
      .eq("id", String(item.id))
      .single();

    if (!prod) continue;

    const updates = {
      stock: Math.max(0, (prod.stock ?? 0) - cantidad),
    };

    const talle = item.talle ?? "";
    if (talle && prod.stock_por_talle?.[talle] !== undefined) {
      updates.stock_por_talle = {
        ...prod.stock_por_talle,
        [talle]: Math.max(0, prod.stock_por_talle[talle] - cantidad),
      };
    }

    await supabaseAdmin().from("productos_stock").update(updates).eq("id", String(item.id));
  }
}

export async function PATCH(request, { params }) {
  try {
    const { estado } = await request.json();
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    // Traer el pedido actual para conocer sus items y si ya se descontó stock.
    const { data: pedidoActual, error: errGet } = await supabaseAdmin()
      .from("pedidos")
      .select("*")
      .eq("id", params.id)
      .single();
    if (errGet) throw errGet;

    const updates = { estado };

    // Descontar stock SOLO la primera vez que el pedido pasa a "pagado".
    // El flag stock_descontado evita descontar dos veces (ej: pagado→enviado→pagado,
    // o pedidos de MercadoPago que ya descontaron vía webhook).
    if (estado === "pagado" && !pedidoActual.stock_descontado) {
      await descontarStock(pedidoActual.items ?? []);
      updates.stock_descontado = true;
      // Purchase a Meta (Conversions API) al confirmar el pago — así las
      // transferencias marcadas como pagadas también cuentan en las métricas.
      await sendPurchaseEvent(pedidoActual);
      await sendTikTokPurchase(pedidoActual);
      // Email de confirmación al comprador (mismo que reciben los de MP).
      await enviarConfirmacionPago(pedidoActual);
    }

    const { data, error } = await supabaseAdmin()
      .from("pedidos")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err) {
    console.error("Error updating pedido:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { error } = await supabaseAdmin()
      .from("pedidos")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error deleting pedido:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
