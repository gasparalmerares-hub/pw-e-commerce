import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { sinAtribucion } from "@/lib/metaAtribucion";

export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

export async function GET() {
  noStore();
  try {
    // Incluir todo lo que NO es "pendiente" (MP confirmado, enviado, etc.)
    // PLUS pendientes que tengan [TRANSFERENCIA] en observaciones.
    const { data, error } = await supabaseAdmin()
      .from("pedidos")
      .select("*")
      .or("estado.neq.pendiente,observaciones.ilike.%[TRANSFERENCIA]%,observaciones.ilike.%[MAYORISTA]%")
      .order("created_at", { ascending: false });

    if (error) throw error;
    // Los datos para Meta que viajan en observaciones no se muestran (panel ni Excel)
    const pedidos = (data ?? []).map((p) => ({ ...p, observaciones: sinAtribucion(p.observaciones) }));
    return NextResponse.json(pedidos, { headers: NO_CACHE });
  } catch (err) {
    console.error("Error fetching pedidos:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE });
  }
}
