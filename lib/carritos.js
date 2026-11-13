// Carritos abandonados: pedidos que quedaron en "pendiente" y nunca se
// pagaron. Hay tres casos:
//   - "datos": la persona escribió su teléfono o mail en Finalizar compra y
//     no tocó pagar. La web lo guarda en pedidos con observaciones que
//     empiezan con [CARRITO] (ver /api/carritos). Se borra cuando paga.
//   - "mercadopago": tocó pagar con Mercado Pago y no terminó el pago.
//   - "transferencia": eligió transferencia y nunca se marcó como pagado.
// Ninguno aparece en /api/admin/pedidos; se ven en Admin → Carritos.

export const MARCA_CARRITO = "[CARRITO]";

export const esCarrito = (p) => (p?.observaciones ?? "").startsWith(MARCA_CARRITO);

export function tipoAbandono(p) {
  if (esCarrito(p)) return "datos";
  if ((p?.observaciones ?? "").includes("[TRANSFERENCIA]")) return "transferencia";
  return "mercadopago";
}

// Teléfono como lo guarda el checkout (código de área + celular, a veces con
// 0 o 15) → número para wa.me (549 + 10 dígitos), o null si no se puede armar.
export function whatsappDe(telefono) {
  const todo = String(telefono ?? "").replace(/\D/g, "");
  let d = todo;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9") && d.length === 11) d = d.slice(1);
  d = d.replace(/^0/, "");
  if (d.length === 12) {
    for (const n of [2, 3, 4]) {
      if (d.slice(n, n + 2) === "15") { d = d.slice(0, n) + d.slice(n + 2); break; }
    }
  }
  if (d.length === 10) return "549" + d;
  // Mucha gente pone el código postal (o repite el área) en "Cód. de área" y
  // el celular completo en "Celular": el número real son los últimos dígitos.
  // Un celular argentino de 10 dígitos empieza con 1, 2 o 3.
  if (todo.length >= 12) {
    const x = todo.slice(-12);
    for (const n of [2, 3, 4]) {
      if (x.slice(n, n + 2) === "15") {
        const y = x.slice(0, n) + x.slice(n + 2);
        if (/^[123]/.test(y)) return "549" + y;
      }
    }
  }
  if (todo.length > 10 && /^[123]/.test(todo.slice(-10))) return "549" + todo.slice(-10);
  return null;
}

// Últimos 8 dígitos: para reconocer a la misma persona aunque haya escrito
// el teléfono distinto en otro pedido.
export const claveTelefono = (t) => String(t ?? "").replace(/\D/g, "").slice(-8);
