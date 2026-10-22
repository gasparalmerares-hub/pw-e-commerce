import { supabaseAdmin } from "@/lib/supabase";
import { MARCA_CARRITO } from "@/lib/carritos";
import { esPedidoMayorista } from "@/lib/mayorista";
import { esUUID, itemsVigentes } from "@/lib/carritosServidor";

const corto = (v, n) => String(v ?? "").trim().slice(0, n);

export const dynamic = "force-dynamic";

// El botón "Terminar mi compra" del mail de recordatorio lleva a
// /carrito?recuperar=<id>, que pide acá los productos de ese carrito con
// precio y stock de hoy. Devuelve solo productos, nunca datos de la persona.
export async function GET(request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!esUUID(id)) return Response.json({ items: [] }, { status: 400 });
  try {
    const db = supabaseAdmin();
    const { data: p } = await db.from("pedidos").select("items, observaciones")
      .eq("id", id).eq("estado", "pendiente").maybeSingle();
    const items = p && !esPedidoMayorista(p) ? await itemsVigentes(db, p.items) : [];
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[carritos] Error al recuperar:", err?.message);
    return Response.json({ items: [] }, { status: 500 });
  }
}

// Guarda (o actualiza) el carrito de quien está en Finalizar compra apenas
// escribió su teléfono o mail, para poder contactarlo si no termina la
// compra. Se guarda en pedidos como "pendiente" con [CARRITO] en
// observaciones; al crear el pedido real (Mercado Pago o transferencia) se
// borra. Solo puede tocar filas [CARRITO], nunca pedidos de verdad.
export async function POST(request) {
  try {
    const b = await request.json();
    const items = (Array.isArray(b?.items) ? b.items : []).slice(0, 30).map((i) => ({
      id:       corto(i.id, 64),
      nombre:   corto(i.nombre, 120),
      talle:    corto(i.talle, 20),
      precio:   Number(i.precio) || 0,
      cantidad: Math.min(99, Math.max(1, Number(i.cantidad) || 1)),
      tabla:    i.tabla ? corto(i.tabla, 40) : null,
    }));
    const email    = corto(b?.email, 120);
    const telefono = String(b?.telefono ?? "").replace(/\D/g, "").slice(0, 20);
    if (!items.length || (!/^\S+@\S+\.\S+$/.test(email) && telefono.length < 8)) {
      return Response.json({ error: "Faltan datos" }, { status: 400 });
    }

    const fila = {
      nombre:        corto(b?.nombre, 120),
      email,
      telefono,
      provincia:     corto(b?.provincia, 60),
      localidad:     corto(b?.localidad, 80),
      items,
      total:         items.reduce((s, i) => s + i.precio * i.cantidad, 0),
      estado:        "pendiente",
      observaciones: MARCA_CARRITO,
    };

    const db = supabaseAdmin();
    if (esUUID(b?.id)) {
      const { data } = await db.from("pedidos").update(fila)
        .eq("id", b.id).eq("estado", "pendiente").like("observaciones", `${MARCA_CARRITO}%`)
        .select("id").maybeSingle();
      if (data?.id) return Response.json({ id: data.id });
    }
    const { data, error } = await db.from("pedidos").insert(fila).select("id").single();
    if (error) throw error;
    return Response.json({ id: data.id });
  } catch (err) {
    console.error("[carritos] Error:", err?.message);
    return Response.json({ error: "No se pudo guardar" }, { status: 500 });
  }
}
