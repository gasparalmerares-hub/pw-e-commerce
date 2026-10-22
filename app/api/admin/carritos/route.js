import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { esPedidoMayorista } from "@/lib/mayorista";
import { tipoAbandono, whatsappDe, claveTelefono } from "@/lib/carritos";

export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store" };
const DIAS = 90;

// Carritos abandonados de los últimos 90 días (solo admin, ver middleware):
// pedidos minoristas que quedaron "pendiente". Una fila por persona (la más
// reciente), avisando si igual compró.
export async function GET() {
  noStore();
  try {
    const db = supabaseAdmin();
    const desde = new Date(Date.now() - DIAS * 864e5).toISOString();
    const [{ data: pendientes, error }, { data: pagos }] = await Promise.all([
      db.from("pedidos")
        .select("id, created_at, nombre, email, telefono, provincia, localidad, items, total, observaciones, metodo_pago")
        .eq("estado", "pendiente").gte("created_at", desde).order("created_at", { ascending: false }),
      db.from("pedidos").select("email, telefono, created_at")
        .in("estado", ["pagado", "enviado", "entregado"])
        .gte("created_at", new Date(Date.now() - (DIAS + 2) * 864e5).toISOString()),
    ]);
    if (error) throw error;

    // Ya compró: tiene un pedido pagado desde 2 días antes del abandono en
    // adelante. Cubre al que compró después y al que pagó por transferencia y
    // enseguida tocó también Mercado Pago (o al revés) y dejó ese sin pagar.
    const yaCompro = (p) => (pagos ?? []).some((q) =>
      new Date(q.created_at) >= new Date(p.created_at) - 2 * 864e5 && (
        (p.email && q.email && q.email.trim().toLowerCase() === p.email.trim().toLowerCase()) ||
        (claveTelefono(p.telefono).length === 8 && claveTelefono(q.telefono) === claveTelefono(p.telefono))
      ));

    const vistos = new Map();
    for (const p of pendientes ?? []) {
      if (esPedidoMayorista(p)) continue;
      const clave = claveTelefono(p.telefono) || (p.email ?? "").trim().toLowerCase() || p.id;
      if (vistos.has(clave)) { vistos.get(clave).intentos += 1; continue; }
      vistos.set(clave, {
        id:        p.id,
        fecha:     p.created_at,
        tipo:      tipoAbandono(p),
        nombre:    p.nombre ?? "",
        email:     p.email ?? "",
        telefono:  p.telefono ?? "",
        whatsapp:  whatsappDe(p.telefono),
        lugar:     [p.localidad, p.provincia].filter(Boolean).join(", "),
        productos: (p.items ?? []).filter((i) => i.id !== "envio" && i.id !== "estampa")
                     .map((i) => ({ nombre: i.nombre, talle: i.talle, cantidad: Number(i.cantidad) || 1 })),
        total:     Number(p.total) || 0,
        yaCompro:  yaCompro(p),
        intentos:  1,
      });
    }
    return Response.json([...vistos.values()], { headers: NO_CACHE });
  } catch (err) {
    console.error("[admin carritos] Error:", err?.message);
    return Response.json({ error: err.message }, { status: 500, headers: NO_CACHE });
  }
}
