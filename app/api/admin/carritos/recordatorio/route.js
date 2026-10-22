import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { carritosAbandonados, itemsVigentes } from "@/lib/carritosServidor";
import { candidatosRecordatorio, htmlRecordatorio, asuntoRecordatorio } from "@/lib/recordatorioCarrito";

export const dynamic = "force-dynamic";

// Solo admin, para revisar el mail automático sin mandarlo:
//   GET            → a quiénes les llegaría en el próximo envío
//   GET ?ver=<id>  → cómo se ve el mail de ese carrito
export async function GET(request) {
  noStore();
  try {
    const db = supabaseAdmin();
    const id = new URL(request.url).searchParams.get("ver");
    if (!id) {
      const proximos = (await candidatosRecordatorio(db))
        .map((c) => ({ id: c.id, fecha: c.fecha, tipo: c.tipo, nombre: c.nombre, email: c.email }));
      return Response.json({ proximos }, { headers: { "Cache-Control": "no-store" } });
    }
    const c = (await carritosAbandonados(db, 90)).find((x) => x.id === id);
    if (!c) return Response.json({ error: "No encontrado" }, { status: 404 });
    const items = await itemsVigentes(db, c.items);
    const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    const html = `<p style="font-family:Arial;color:#6b7280">Asunto: <b>${esc(asuntoRecordatorio(c.nombre))}</b> · Para: ${esc(c.email || "(sin mail)")}</p>`
      + htmlRecordatorio({ nombre: c.nombre, items, id: c.id });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[admin recordatorio] Error:", err?.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
