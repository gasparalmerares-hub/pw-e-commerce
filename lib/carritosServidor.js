// Solo servidor (usa supabaseAdmin). Lo comparten Admin → Carritos, el mail
// automático de recordatorio (lib/recordatorioCarrito.js) y las rutas que
// crean el pedido real (Mercado Pago y transferencia), que borran el carrito
// abandonado que la web había guardado mientras la persona completaba sus datos.

import { supabaseAdmin } from "@/lib/supabase";
import { esPedidoMayorista } from "@/lib/mayorista";
import { MARCA_CARRITO, tipoAbandono, whatsappDe, claveTelefono } from "@/lib/carritos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUUID = (id) => UUID_RE.test(id ?? "");

export async function borrarCarrito(id) {
  if (!esUUID(id)) return;
  try {
    await supabaseAdmin().from("pedidos").delete()
      .eq("id", id).eq("estado", "pendiente").like("observaciones", `${MARCA_CARRITO}%`);
  } catch (err) {
    console.error("[carritos] No se pudo borrar:", err?.message);
  }
}

// Datos internos del panel guardados como JSON en configuracion
// (carritos_contactados, carritos_mail_enviado). /api/config no los expone.
export async function leerConfigJSON(db, clave) {
  const { data } = await db.from("configuracion").select("valor").eq("clave", clave).maybeSingle();
  try { return JSON.parse(data?.valor || "{}") || {}; } catch { return {}; }
}

// Guarda { clave: fechaISO } olvidando las fechas de más de 120 días (los
// carritos se muestran 90).
export async function guardarConfigJSON(db, clave, obj) {
  const limite = new Date(Date.now() - 120 * 864e5).toISOString();
  for (const [k, fecha] of Object.entries(obj)) if (fecha < limite) delete obj[k];
  const valor = JSON.stringify(obj);
  const { data: existe } = await db.from("configuracion").select("clave").eq("clave", clave).maybeSingle();
  const { error } = existe
    ? await db.from("configuracion").update({ valor }).eq("clave", clave)
    : await db.from("configuracion").insert({ clave, valor });
  if (error) throw error;
  return obj;
}

export const CLAVE_CONTACTADOS = "carritos_contactados";
export const CLAVE_MAILS       = "carritos_mail_enviado";

const sinExtras = (items) => (items ?? []).filter((i) => i.id !== "envio" && i.id !== "estampa");

// Carritos abandonados de los últimos `dias`: pedidos minoristas que quedaron
// "pendiente". Una fila por persona (la más reciente), avisando si igual compró.
export async function carritosAbandonados(db, dias = 90) {
  const desde = new Date(Date.now() - dias * 864e5).toISOString();
  const [{ data: pendientes, error }, { data: pagos }, contactados, mails] = await Promise.all([
    db.from("pedidos")
      .select("id, created_at, nombre, email, telefono, provincia, localidad, items, total, observaciones, metodo_pago")
      .eq("estado", "pendiente").gte("created_at", desde).order("created_at", { ascending: false }),
    db.from("pedidos").select("email, telefono, created_at")
      .in("estado", ["pagado", "enviado", "entregado"])
      .gte("created_at", new Date(Date.now() - (dias + 2) * 864e5).toISOString()),
    leerConfigJSON(db, CLAVE_CONTACTADOS),
    leerConfigJSON(db, CLAVE_MAILS),
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
    const email = (p.email ?? "").trim();
    vistos.set(clave, {
      id:        p.id,
      fecha:     p.created_at,
      tipo:      tipoAbandono(p),
      nombre:    p.nombre ?? "",
      email,
      telefono:  p.telefono ?? "",
      whatsapp:  whatsappDe(p.telefono),
      lugar:     [p.localidad, p.provincia].filter(Boolean).join(", "),
      productos: sinExtras(p.items).map((i) => ({ nombre: i.nombre, talle: i.talle, cantidad: Number(i.cantidad) || 1 })),
      items:     sinExtras(p.items),
      total:     Number(p.total) || 0,
      yaCompro:  yaCompro(p),
      contactado: contactados[p.id] ?? null,
      mailEnviado: (email && mails[email.toLowerCase()]) || null,
      intentos:  1,
    });
  }
  return [...vistos.values()];
}

// Los productos de un carrito tal como están hoy en la tienda (precio, foto y
// stock actuales), en el formato del carrito del navegador. Se saltean los
// que ya no existen o no tienen stock del talle. Lo usan el botón del mail
// para volver a armar el carrito y el propio mail para mostrar los productos.
export async function itemsVigentes(db, items) {
  const porTabla = { productos_stock: [], productos_catalogo: [] };
  for (const i of sinExtras(items)) if (porTabla[i.tabla]) porTabla[i.tabla].push(String(i.id));

  const productos = {};
  await Promise.all(Object.entries(porTabla).filter(([, ids]) => ids.length).map(async ([tabla, ids]) => {
    const { data } = await db.from(tabla).select("*").in("id", [...new Set(ids)]);
    for (const p of data ?? []) productos[`${tabla}:${p.id}`] = p;
  }));

  const resultado = [];
  for (const i of sinExtras(items)) {
    const p = productos[`${i.tabla}:${i.id}`];
    if (!p) continue;
    const item = {
      id: p.id, nombre: p.nombre, talle: i.talle, precio: Number(p.precio) || 0,
      cantidad: Number(i.cantidad) || 1, imagen: p.imagen ?? null, tabla: i.tabla,
      descuentoTransferencia: p.descuento_transferencia ?? 0, seccion: "camiseta",
    };
    if (i.tabla === "productos_stock") {
      const stock = Number(p.stock_por_talle?.[i.talle] ?? p.stock ?? 0);
      if (stock <= 0) continue;
      item.stock = stock;
      item.cantidad = Math.min(item.cantidad, stock);
      if (p.tipo_variante === "color" || p.seccion === "bucal") item.seccion = "bucal";
    }
    resultado.push(item);
  }
  return resultado;
}
