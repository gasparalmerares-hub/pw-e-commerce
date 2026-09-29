import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

// Estado de cada camiseta por encargo frente al proveedor. Se guarda dentro del
// item del pedido (item.encargo = { estado, encargadoEl, llegoEl }), así no hace
// falta tocar el esquema de la base. Sin item.encargo = todavía por encargar.
const ESTADOS = ["por_encargar", "encargado", "llego"];

// body: { cambios: [{ pedidoId, index, id, talle, estado }] }
// `index` es la posición del item en pedido.items; `id` y `talle` se usan para
// confirmar que el índice sigue apuntando a la misma camiseta.
export async function PATCH(request) {
  noStore();
  try {
    const { cambios } = await request.json();
    if (!Array.isArray(cambios) || cambios.length === 0) {
      return Response.json({ error: "Sin cambios" }, { status: 400 });
    }

    const porPedido = new Map();
    for (const c of cambios) {
      if (!ESTADOS.includes(c?.estado) || !Number.isInteger(c?.index) || !c?.pedidoId) {
        return Response.json({ error: "Cambio inválido" }, { status: 400 });
      }
      if (!porPedido.has(c.pedidoId)) porPedido.set(c.pedidoId, []);
      porPedido.get(c.pedidoId).push(c);
    }

    const db    = supabaseAdmin();
    const ahora = new Date().toISOString();
    let actualizados = 0;

    for (const [pedidoId, lista] of porPedido) {
      const { data: pedido, error } = await db.from("pedidos").select("items").eq("id", pedidoId).single();
      if (error || !pedido) continue;

      const items = [...(pedido.items ?? [])];
      for (const c of lista) {
        const it = items[c.index];
        if (!it || it.tabla !== "productos_catalogo") continue;
        if (String(it.id) !== String(c.id) || String(it.talle ?? "") !== String(c.talle ?? "")) continue;

        if (c.estado === "por_encargar") {
          const { encargo, ...resto } = it; // eslint-disable-line no-unused-vars
          items[c.index] = resto;
        } else if (c.estado === "encargado") {
          items[c.index] = { ...it, encargo: { encargadoEl: it.encargo?.encargadoEl ?? ahora, estado: "encargado" } };
        } else {
          items[c.index] = { ...it, encargo: { encargadoEl: it.encargo?.encargadoEl ?? ahora, llegoEl: ahora, estado: "llego" } };
        }
        actualizados++;
      }

      const { error: errUpd } = await db.from("pedidos").update({ items }).eq("id", pedidoId);
      if (errUpd) throw errUpd;
    }

    return Response.json({ ok: true, actualizados });
  } catch (err) {
    console.error("[encargos] Error:", err);
    return Response.json({ error: err.message ?? "Error al guardar" }, { status: 500 });
  }
}
