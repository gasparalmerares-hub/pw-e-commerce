import { supabaseAdmin } from "@/lib/supabase";
import { CARGA_ENCARGO, camisetasEnCarga } from "@/lib/mayorista";

export const dynamic = "force-dynamic";

// Avance de la carga a fábrica de los pedidos a medida, para mostrarlo en
// /mayorista. Solo devuelve el número (nunca datos de pedidos): conteo
// automático + ajuste manual de la tienda (Admin → Encargos).
export async function GET() {
  try {
    const db = supabaseAdmin();
    const [{ data: pedidos, error }, { data: ajuste }] = await Promise.all([
      db.from("pedidos").select("estado, observaciones, items").eq("estado", "pagado").ilike("observaciones", "%[ENCARGO]%"),
      db.from("configuracion").select("valor").eq("clave", "carga_ajuste").maybeSingle(),
    ]);
    if (error) throw error;

    const actual = Math.max(0, camisetasEnCarga(pedidos) + (parseInt(ajuste?.valor) || 0));
    return Response.json(
      { actual, capacidad: CARGA_ENCARGO },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } }
    );
  } catch (err) {
    console.error("[carga] Error:", err.message);
    return Response.json({ error: "No disponible" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
