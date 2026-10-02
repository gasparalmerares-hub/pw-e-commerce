import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { MINIMO_MAYORISTA, precioMayoristaUSD } from "@/lib/mayorista";
import { getDolarBlue } from "@/lib/dolar";

export const dynamic = "force-dynamic";

// Registra un pedido mayorista de camisetas en stock. Todo se recalcula acá
// (stock disponible, escala de precio y dólar blue): no se confía en lo que
// manda el navegador. El pedido queda pendiente y el stock se descuenta recién
// cuando la tienda lo marca como "pagado" en el panel (igual que transferencias).
//
// body: { items: [{ id, talle, cantidad }], comprador: { nombre, celular, provincia, localidad } }
export async function POST(request) {
  noStore();
  try {
    const { items, comprador } = await request.json();
    if (!comprador?.nombre?.trim() || !comprador?.celular?.trim()) {
      return Response.json({ error: "Completá tu nombre y celular." }, { status: 400 });
    }

    const pedidos = (Array.isArray(items) ? items : [])
      .map((i) => ({ id: String(i.id), talle: String(i.talle ?? ""), cantidad: parseInt(i.cantidad) || 0 }))
      .filter((i) => i.cantidad > 0);
    const cantidadTotal = pedidos.reduce((s, i) => s + i.cantidad, 0);
    if (cantidadTotal < MINIMO_MAYORISTA) {
      return Response.json({ error: `El pedido mayorista es de ${MINIMO_MAYORISTA} camisetas como mínimo.` }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: productos, error: errProd } = await db
      .from("productos_stock")
      .select("id, nombre, imagen, talle, stock_por_talle, seccion")
      .in("id", [...new Set(pedidos.map((i) => i.id))]);
    if (errProd) throw errProd;
    const porId = new Map((productos ?? []).map((p) => [String(p.id), p]));

    // Verificar que cada camiseta y talle exista y tenga stock suficiente
    const pedidoPorTalle = new Map();
    for (const i of pedidos) {
      const k = `${i.id}|${i.talle}`;
      pedidoPorTalle.set(k, (pedidoPorTalle.get(k) ?? 0) + i.cantidad);
    }
    for (const [k, cantidad] of pedidoPorTalle) {
      const [id, talle] = k.split("|");
      const p = porId.get(id);
      const disponible = Number(p?.stock_por_talle?.[talle]) || 0;
      if (!p || (p.seccion ?? "camiseta") === "bucal" || !(p.talle ?? []).includes(talle) || disponible < cantidad) {
        return Response.json({
          error: `No hay stock suficiente de ${p?.nombre?.trim() ?? "una camiseta"} talle ${talle} (quedan ${disponible}). Actualizá la página y revisá tu pedido.`,
        }, { status: 409 });
      }
    }

    const precioUSD = precioMayoristaUSD(cantidadTotal);
    const dolar     = await getDolarBlue();
    const precioARS = Math.round(precioUSD * dolar.venta);
    const totalUSD  = precioUSD * cantidadTotal;
    const totalARS  = precioARS * cantidadTotal;

    const filas = [...pedidoPorTalle.entries()].map(([k, cantidad]) => {
      const [id, talle] = k.split("|");
      const p = porId.get(id);
      return {
        id, talle, cantidad,
        nombre:     p.nombre,
        imagen:     p.imagen,
        precio:     precioARS,       // en pesos, como el resto de los pedidos
        precioUSD,
        tabla:      "productos_stock",
        seccion:    "camiseta",
        mayorista:  true,
      };
    });

    const resumen = `${cantidadTotal} camisetas × USD ${precioUSD} = USD ${totalUSD} · ` +
      `Dólar blue $${dolar.venta.toLocaleString("es-AR")} → $${totalARS.toLocaleString("es-AR")}`;
    const fila = {
      nombre:        comprador.nombre.trim(),
      email:         comprador.email?.trim() ?? "",
      telefono:      comprador.celular.trim(),
      provincia:     comprador.provincia ?? "",
      localidad:     comprador.localidad ?? "",
      observaciones: `[MAYORISTA] ${resumen}`,
      items:         filas,
      total:         totalARS,
      estado:        "pendiente_transferencia",
      metodo_pago:   "mayorista",
    };

    let { data, error } = await db.from("pedidos").insert(fila).select("id").single();
    // Mismo resguardo que en transferencias: si la base no acepta el estado,
    // queda "pendiente" y el panel lo muestra igual por la etiqueta [MAYORISTA].
    if (error) {
      console.error("[mayorista] Insert con pendiente_transferencia falló:", error.message);
      ({ data, error } = await db.from("pedidos").insert({ ...fila, estado: "pendiente" }).select("id").single());
    }
    if (error) throw error;

    return Response.json({
      id: data.id,
      cantidad: cantidadTotal,
      precioUSD, totalUSD,
      dolar: dolar.venta,
      precioARS, totalARS,
      items: filas.map(({ id, nombre, talle, cantidad, imagen }) => ({ id, nombre, talle, cantidad, imagen })),
    });
  } catch (err) {
    console.error("[mayorista] Error:", err);
    return Response.json({ error: "No se pudo registrar el pedido. Probá de nuevo." }, { status: 500 });
  }
}
