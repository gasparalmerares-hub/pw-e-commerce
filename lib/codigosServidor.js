// Solo servidor. Los códigos se guardan en configuracion.codigos_descuento
// como JSON { CODIGO: { porcentaje, activo, vence, maxUsos, soloClientes, creado } }
// (vence = "AAAA-MM-DD" o null; maxUsos = número o null; soloClientes = solo
// lo usa quien ya tiene una compra pagada con ese mismo email). /api/config no
// expone esa clave. Los usos se cuentan con los pedidos pagados que tienen
// la marca [CODIGO ...] en observaciones (ver lib/codigos.js).

import { supabaseAdmin } from "@/lib/supabase";
import { normalizarCodigo } from "@/lib/codigos";

export const CLAVE_CODIGOS = "codigos_descuento";

export async function leerCodigos(db = supabaseAdmin()) {
  const { data } = await db.from("configuracion").select("valor").eq("clave", CLAVE_CODIGOS).maybeSingle();
  try {
    const obj = JSON.parse(data?.valor || "{}");
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

export async function guardarCodigos(codigos, db = supabaseAdmin()) {
  const valor = JSON.stringify(codigos);
  const { data: existe } = await db.from("configuracion").select("clave").eq("clave", CLAVE_CODIGOS).maybeSingle();
  const { error } = existe
    ? await db.from("configuracion").update({ valor }).eq("clave", CLAVE_CODIGOS)
    : await db.from("configuracion").insert({ clave: CLAVE_CODIGOS, valor });
  if (error) throw error;
}

// { CODIGO: cantidad de pedidos pagados que lo usaron }
export async function usosPorCodigo(db = supabaseAdmin()) {
  const { data } = await db.from("pedidos").select("observaciones")
    .in("estado", ["pagado", "enviado", "entregado"])
    .like("observaciones", "%[CODIGO %");
  const usos = {};
  for (const p of data ?? []) {
    const m = String(p.observaciones ?? "").match(/\[CODIGO ([A-Z0-9]+) -/);
    if (m) usos[m[1]] = (usos[m[1]] ?? 0) + 1;
  }
  return usos;
}

// Vence al terminar ese día, hora de Argentina
export const vencido = (vence) => !!vence && new Date() > new Date(`${vence}T23:59:59-03:00`);

// ¿Este email ya tiene una compra pagada? (para los códigos "solo clientes")
async function yaCompro(db, email) {
  const limpio = String(email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(limpio)) return false;
  // ilike para no depender de mayúsculas; % y _ son comodines, así que se
  // escapan y la comparación final es exacta
  const patron = limpio.replace(/[\\%_]/g, (c) => "\\" + c);
  const { data } = await db.from("pedidos").select("email")
    .in("estado", ["pagado", "enviado", "entregado"])
    .ilike("email", `%${patron}%`)
    .limit(20);
  return (data ?? []).some((p) => String(p.email ?? "").trim().toLowerCase() === limpio);
}

// { codigo, porcentaje } si se puede usar ahora, o { error } para mostrar al
// comprador. `email` es el que escribió en Finalizar compra.
export async function validarCodigo(texto, email) {
  const codigo = normalizarCodigo(texto);
  if (!codigo) return { error: "Escribí un código." };
  const db = supabaseAdmin();
  const c = (await leerCodigos(db))[codigo];
  if (!c || !c.activo) return { error: "Ese código no existe o ya no está activo." };
  if (vencido(c.vence)) return { error: "Ese código ya venció." };
  if (c.maxUsos) {
    const usos = (await usosPorCodigo(db))[codigo] ?? 0;
    if (usos >= c.maxUsos) return { error: "Ese código ya se usó el máximo de veces." };
  }
  if (c.soloClientes) {
    if (!/^\S+@\S+\.\S+$/.test(String(email ?? "").trim())) {
      return { error: "Este código es para clientes: primero escribí tu email (el mismo con el que hiciste tu compra anterior)." };
    }
    if (!(await yaCompro(db, email))) {
      return { error: "Este código es solo para clientes que ya compraron. Usá el mismo email de tu compra anterior." };
    }
  }
  return { codigo, porcentaje: Number(c.porcentaje) };
}

// Para las API de pedidos: sin código → { codigo: null }; código que ya no
// sirve → { error } (el checkout lo saca y avisa)
export async function codigoDelPedido(texto, email) {
  if (!normalizarCodigo(texto)) return { codigo: null };
  const r = await validarCodigo(texto, email);
  return r.error ? { error: r.error } : { codigo: r };
}
