// Intentos de pago de un pedido en Mercado Pago (external_reference = id del
// pedido), del más nuevo al más viejo. Sirve para saber por qué no se pagó
// un pedido que quedó "pendiente": tarjeta rechazada, pago en efectivo que
// todavía no se hizo, o nunca intentó pagar (lista vacía). null si falla.

export async function pagosDePedido(pedidoId) {
  if (!process.env.MP_ACCESS_TOKEN) return null;
  try {
    const url = `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(pedidoId)}&sort=date_created&criteria=desc&limit=20`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results ?? []).map((p) => ({
      estado:  p.status,
      detalle: p.status_detail,
      medio:   p.payment_method_id,
      tipo:    p.payment_type_id,
      fecha:   p.date_created,
    }));
  } catch {
    return null;
  }
}

// Estados en los que el pago ya está hecho o en curso (por ejemplo, un
// cupón de Rapipago o Pago Fácil que todavía no se pagó).
export const PAGO_EN_CURSO = ["approved", "authorized", "in_process", "pending"];
