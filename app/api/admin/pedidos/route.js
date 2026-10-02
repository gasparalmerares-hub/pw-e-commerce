import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";

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
    return NextResponse.json(data, { headers: NO_CACHE });
  } catch (err) {
    console.error("Error fetching pedidos:", err);
    return NextResponse.json({ error: err.message }, { status: 500, headers: NO_CACHE });
  }
}
