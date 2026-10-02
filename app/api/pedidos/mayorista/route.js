import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import {
  MINIMO_MAYORISTA, ESCALAS_STOCK, ESCALAS_ENCARGO, PRECIO_PERSONALIZACION_USD, SENA_ENCARGO,
  precioPorEscala, cantidadPersonalizaciones, redondearUSD, formatoUSD,
} from "@/lib/mayorista";
import { getDolarBlue } from "@/lib/dolar";
import { atribucionDesdeRequest, conAtribucion } from "@/lib/metaAtribucion";

export const dynamic = "force-dynamic";

// Registra un pedido mayorista. Todo se recalcula acá (stock o catálogo,
// escala de precio, personalización y dólar blue): no se confía en lo que
// manda el navegador. El pedido queda pendiente hasta que la tienda lo marca
// como "pagado" en el panel; recién ahí se descuenta el stock (modalidad stock)
// o pasa a la sección Encargos para pedirlo a fábrica (modalidad encargo).
//
// body: {
//   tipo: "stock" | "encargo",
//   items: stock   → [{ id, talle, cantidad }]
//          encargo → [{ id, talle, personalizaciones: [{ nombre, numero } | null, ...] }]
//   comprador: { nombre, celular, provincia, localidad },
// }

const pesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");

function limpiarPers(p) {
  const nombre = String(p?.nombre ?? "").trim().slice(0, 20);
  const numero = String(p?.numero ?? "").replace(/\D/g, "").slice(0, 3);
  return nombre || numero ? { nombre, numero } : null;
}

export async function POST(request) {
  noStore();
  try {
    const { tipo = "stock", items, comprador } = await request.json();
    if (!["stock", "encargo"].includes(tipo)) {
      return Response.json({ error: "Tipo de pedido inválido." }, { status: 400 });
    }
    if (!comprador?.nombre?.trim() || !comprador?.celular?.trim()) {
      return Response.json({ error: "Completá tu nombre y celular." }, { status: 400 });
    }

    // Una línea por modelo y talle
    const lineas = new Map();
    for (const i of Array.isArray(items) ? items : []) {
      const k = `${String(i.id)}|${String(i.talle ?? "")}`;
      const l = lineas.get(k) ?? { id: String(i.id), talle: String(i.talle ?? ""), cantidad: 0, personalizaciones: [] };
      if (tipo === "encargo") {
        const pers = (Array.isArray(i.personalizaciones) ? i.personalizaciones : []).slice(0, 500).map(limpiarPers);
        l.personalizaciones.push(...pers);
        l.cantidad += pers.length;
      } else {
        l.cantidad += Math.max(0, parseInt(i.cantidad) || 0);
      }
      if (l.cantidad > 0) lineas.set(k, l);
    }
    const cantidadTotal = [...lineas.values()].reduce((s, l) => s + l.cantidad, 0);
    if (cantidadTotal < MINIMO_MAYORISTA) {
      return Response.json({ error: `El pedido mayorista es de ${MINIMO_MAYORISTA} camisetas como mínimo.` }, { status: 400 });
    }

    const db = supabaseAdmin();
    const tabla = tipo === "stock" ? "productos_stock" : "productos_catalogo";
    const { data: productos, error: errProd } = await db
      .from(tabla)
      .select("id, nombre, imagen, talle, stock_por_talle, seccion")
      .in("id", [...new Set([...lineas.values()].map((l) => l.id))]);
    if (errProd) throw errProd;
    const porId = new Map((productos ?? []).map((p) => [String(p.id), p]));

    for (const l of lineas.values()) {
      const p = porId.get(l.id);
      if (!p || !(p.talle ?? []).includes(l.talle)) {
        return Response.json({ error: "Una de las camisetas ya no está disponible en ese talle. Actualizá la página y revisá tu pedido." }, { status: 409 });
      }
      if (tipo === "stock") {
        const disponible = Number(p.stock_por_talle?.[l.talle]) || 0;
        if ((p.seccion ?? "camiseta") === "bucal" || disponible < l.cantidad) {
          return Response.json({
            error: `No hay stock suficiente de ${p.nombre.trim()} talle ${l.talle} (quedan ${disponible}). Actualizá la página y revisá tu pedido.`,
          }, { status: 409 });
        }
      }
    }

    const escala   = precioPorEscala(tipo === "stock" ? ESCALAS_STOCK : ESCALAS_ENCARGO, cantidadTotal);
    const dolar    = await getDolarBlue();
    const precioUSD = escala.precio;
    const precioARS = Math.round(precioUSD * dolar.venta);
    const extras    = tipo === "encargo"
      ? cantidadPersonalizaciones([...lineas.values()].flatMap((l) => l.personalizaciones))
      : 0;
    const totalUSD  = precioUSD * cantidadTotal + extras * PRECIO_PERSONALIZACION_USD;
    const totalARS  = Math.round(totalUSD * dolar.venta);
    const senaUSD   = tipo === "encargo" ? redondearUSD(totalUSD * SENA_ENCARGO) : totalUSD;
    const saldoUSD  = redondearUSD(totalUSD - senaUSD);

    const filas = [...lineas.values()].map((l) => {
      const p = porId.get(l.id);
      return {
        id: l.id, talle: l.talle, cantidad: l.cantidad,
        nombre:    p.nombre,
        imagen:    p.imagen,
        precio:    precioARS,      // en pesos, como el resto de los pedidos
        precioUSD,
        tabla,
        seccion:   tipo === "stock" ? "camiseta" : (p.seccion ?? "catalogo"),
        mayorista: true,
        ...(tipo === "encargo" && l.personalizaciones.some(Boolean) ? { personalizaciones: l.personalizaciones } : {}),
      };
    });
    // La personalización va como renglón aparte (igual que la estampa minorista)
    if (extras > 0) {
      filas.push({
        id: "estampa", nombre: "Personalización (nombre / número)", talle: "-",
        cantidad: extras, precio: Math.round(PRECIO_PERSONALIZACION_USD * dolar.venta), precioUSD: PRECIO_PERSONALIZACION_USD,
      });
    }

    const resumen = tipo === "stock"
      ? `[MAYORISTA] ${cantidadTotal} camisetas × USD ${precioUSD} = ${formatoUSD(totalUSD)} · ` +
        `Dólar blue ${pesos(dolar.venta)} → ${pesos(totalARS)}`
      : `[MAYORISTA] [ENCARGO] ${escala.nombre}: ${cantidadTotal} camisetas × USD ${precioUSD}` +
        (extras ? ` + ${extras} personalizaciones × USD ${PRECIO_PERSONALIZACION_USD}` : "") +
        ` = ${formatoUSD(totalUSD)} · Seña 60%: ${formatoUSD(senaUSD)} (${pesos(senaUSD * dolar.venta)}) · ` +
        `Saldo a la entrega: ${formatoUSD(saldoUSD)} · Dólar blue ${pesos(dolar.venta)}`;

    const fila = {
      nombre:        comprador.nombre.trim(),
      email:         comprador.email?.trim() ?? "",
      telefono:      comprador.celular.trim(),
      provincia:     comprador.provincia ?? "",
      localidad:     comprador.localidad ?? "",
      observaciones: conAtribucion(resumen, atribucionDesdeRequest(request)),
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
      id: data.id, tipo,
      escala: escala.nombre ?? null,
      cantidad: cantidadTotal,
      precioUSD, extras, totalUSD, senaUSD, saldoUSD,
      dolar: dolar.venta,
      totalARS,
      senaARS: Math.round(senaUSD * dolar.venta),
      items: filas.filter((f) => f.id !== "estampa").map(({ id, nombre, talle, cantidad, imagen, personalizaciones }) => (
        { id, nombre, talle, cantidad, imagen, personalizaciones: personalizaciones ?? null }
      )),
    });
  } catch (err) {
    console.error("[mayorista] Error:", err);
    return Response.json({ error: "No se pudo registrar el pedido. Probá de nuevo." }, { status: 500 });
  }
}
