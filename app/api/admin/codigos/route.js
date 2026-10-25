import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizarCodigo } from "@/lib/codigos";
import { leerCodigos, guardarCodigos, usosPorCodigo, vencido } from "@/lib/codigosServidor";

export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };

// Admin → Configuración → Códigos de descuento
export async function GET() {
  noStore();
  try {
    const db = supabaseAdmin();
    const [codigos, usos] = await Promise.all([leerCodigos(db), usosPorCodigo(db)]);
    const lista = Object.entries(codigos)
      .map(([codigo, c]) => ({ codigo, ...c, usos: usos[codigo] ?? 0, vencido: vencido(c.vence) }))
      .sort((a, b) => String(b.creado ?? "").localeCompare(String(a.creado ?? "")));
    return Response.json(lista, { headers: NO_CACHE });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: NO_CACHE });
  }
}

// { accion: "guardar", codigo, porcentaje, activo, vence, maxUsos, soloClientes } o { accion: "borrar", codigo }
export async function POST(request) {
  noStore();
  try {
    const b = await request.json();
    const codigo = normalizarCodigo(b.codigo);
    if (codigo.length < 3) {
      return Response.json({ error: "El código tiene que tener al menos 3 letras o números." }, { status: 400, headers: NO_CACHE });
    }
    const db = supabaseAdmin();
    const codigos = await leerCodigos(db);

    if (b.accion === "borrar") {
      delete codigos[codigo];
    } else {
      const porcentaje = Math.round(Number(b.porcentaje));
      if (!(porcentaje >= 1 && porcentaje <= 90)) {
        return Response.json({ error: "El descuento tiene que ser entre 1% y 90%." }, { status: 400, headers: NO_CACHE });
      }
      const vence = /^\d{4}-\d{2}-\d{2}$/.test(b.vence ?? "") ? b.vence : null;
      const maxUsos = Math.round(Number(b.maxUsos)) > 0 ? Math.round(Number(b.maxUsos)) : null;
      codigos[codigo] = {
        porcentaje,
        activo:  b.activo !== false,
        vence,
        maxUsos,
        soloClientes: b.soloClientes === true,
        creado:  codigos[codigo]?.creado ?? new Date().toISOString(),
      };
    }
    await guardarCodigos(codigos, db);
    return Response.json({ ok: true }, { headers: NO_CACHE });
  } catch (err) {
    console.error("[admin codigos] Error:", err?.message);
    return Response.json({ error: err.message }, { status: 500, headers: NO_CACHE });
  }
}
