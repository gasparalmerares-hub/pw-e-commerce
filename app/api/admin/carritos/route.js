import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { carritosAbandonados, leerConfigJSON, guardarConfigJSON, CLAVE_CONTACTADOS } from "@/lib/carritosServidor";

export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

// Carritos abandonados de los últimos 90 días (solo admin, ver middleware).
// La lista la arma lib/carritosServidor.js. "Contactado" se guarda en
// configuracion.carritos_contactados como { idDelCarrito: fecha }, para que
// se vea igual desde cualquier dispositivo.
export async function GET() {
  noStore();
  try {
    const carritos = await carritosAbandonados(supabaseAdmin(), 90);
    return Response.json(carritos.map(({ items, ...c }) => c), { headers: NO_CACHE });
  } catch (err) {
    console.error("[admin carritos] Error:", err?.message);
    return Response.json({ error: err.message }, { status: 500, headers: NO_CACHE });
  }
}

// Marca o desmarca "Contactado": { ids: [...], contactado: true | false }
export async function POST(request) {
  noStore();
  try {
    const { ids, contactado } = await request.json();
    const lista = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean).slice(0, 200);
    if (!lista.length) return Response.json({ error: "Faltan ids" }, { status: 400, headers: NO_CACHE });

    const db = supabaseAdmin();
    const actuales = await leerConfigJSON(db, CLAVE_CONTACTADOS);
    const hoy = new Date().toISOString();
    for (const id of lista) {
      if (contactado) actuales[id] = actuales[id] ?? hoy;
      else delete actuales[id];
    }
    await guardarConfigJSON(db, CLAVE_CONTACTADOS, actuales);
    return Response.json({ ok: true, contactados: actuales }, { headers: NO_CACHE });
  } catch (err) {
    console.error("[admin carritos] Error al marcar:", err?.message);
    return Response.json({ error: err.message }, { status: 500, headers: NO_CACHE });
  }
}
