import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { esPedidoMayorista } from "@/lib/mayorista";
import { tipoAbandono } from "@/lib/carritos";
import { pagosDePedido } from "@/lib/mpPagos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Solo admin: por qué no se pagaron los pedidos que fueron a Mercado Pago y
// quedaron "pendiente" (?dias=30). Para cada uno, los intentos de pago que
// ve Mercado Pago (vacío = abrió Mercado Pago y no intentó pagar).
export async function GET(request) {
  noStore();
  try {
    const dias = Math.min(90, Number(new URL(request.url).searchParams.get("dias")) || 30);
    const { data, error } = await supabaseAdmin().from("pedidos")
      .select("id, created_at, nombre, total, observaciones, metodo_pago")
      .eq("estado", "pendiente")
      .gte("created_at", new Date(Date.now() - dias * 864e5).toISOString())
      .order("created_at", { ascending: false });
    if (error) throw error;

    const pedidos = (data ?? []).filter((p) => !esPedidoMayorista(p) && tipoAbandono(p) === "mercadopago");
    const detalle = await Promise.all(pedidos.map(async (p) => ({
      fecha: p.created_at, nombre: p.nombre, total: Number(p.total) || 0,
      intentos: await pagosDePedido(p.id),
    })));
    const resumen = {};
    for (const d of detalle) {
      const motivo = d.intentos === null ? "sin datos" : d.intentos[0]?.detalle ?? "no intentó pagar";
      resumen[motivo] = (resumen[motivo] ?? 0) + 1;
    }
    return Response.json({ dias, total: detalle.length, resumen, detalle }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin carritos mp] Error:", err?.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
