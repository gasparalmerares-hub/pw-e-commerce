// Meta Pixel — wrapper defensivo.
// Si NEXT_PUBLIC_META_PIXEL_ID no está seteado o no es numérico,
// todas las funciones son no-op y el sitio funciona igual que antes.
// Cada evento también se manda al píxel de TikTok (lib/ttpixel.js).

import { ttTrack, ttContents } from "@/lib/ttpixel";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
export const PIXEL_ENABLED = !!PIXEL_ID && /^\d+$/.test(PIXEL_ID);

function safeCall(...args) {
  if (!PIXEL_ENABLED) return;
  if (typeof window === "undefined") return;
  if (typeof window.fbq !== "function") return;
  try {
    window.fbq(...args);
  } catch (err) {
    console.warn("[fbpixel] error:", err?.message);
  }
}

export function track(event, params) {
  safeCall("track", event, params);
}

export function trackViewContent({ id, nombre, precio, categoria }) {
  ttTrack("ViewContent", {
    contents: ttContents([{ id, cantidad: 1, precio }]),
    value: Number(precio) || 0,
    currency: "ARS",
  });
  track("ViewContent", {
    content_ids: [String(id)],
    content_name: nombre,
    content_type: "product",
    content_category: categoria,
    value: Number(precio) || 0,
    currency: "ARS",
  });
}

export function trackAddToCart({ id, nombre, precio, cantidad, talle }) {
  ttTrack("AddToCart", {
    contents: ttContents([{ id, cantidad, precio }]),
    value: (Number(precio) || 0) * (Number(cantidad) || 1),
    currency: "ARS",
  });
  track("AddToCart", {
    content_ids: [String(id)],
    content_name: nombre,
    content_type: "product",
    contents: [{ id: String(id), quantity: Number(cantidad) || 1 }],
    value: (Number(precio) || 0) * (Number(cantidad) || 1),
    currency: "ARS",
    custom: { talle },
  });
}

export function trackInitiateCheckout({ items, total }) {
  ttTrack("InitiateCheckout", { contents: ttContents(items), value: Number(total) || 0, currency: "ARS" });
  track("InitiateCheckout", {
    content_ids: items.map((i) => String(i.id)),
    contents: items.map((i) => ({ id: String(i.id), quantity: Number(i.cantidad) || 1 })),
    num_items: items.reduce((s, i) => s + (Number(i.cantidad) || 1), 0),
    value: Number(total) || 0,
    currency: "ARS",
  });
}

export function trackPurchase({ items, total, pedidoId }) {
  ttTrack("CompletePayment", { contents: ttContents(items), value: Number(total) || 0, currency: "ARS" },
    pedidoId ? String(pedidoId) : undefined);
  const params = {
    content_ids: items.map((i) => String(i.id)),
    contents: items.map((i) => ({ id: String(i.id), quantity: Number(i.cantidad) || 1 })),
    num_items: items.reduce((s, i) => s + (Number(i.cantidad) || 1), 0),
    value: Number(total) || 0,
    currency: "ARS",
    order_id: pedidoId ? String(pedidoId) : undefined,
  };
  // Pasamos eventID = pedidoId para que Meta deduplique con el evento
  // server-side (Conversions API) y no cuente la compra dos veces.
  if (pedidoId) {
    safeCall("track", "Purchase", params, { eventID: String(pedidoId) });
  } else {
    safeCall("track", "Purchase", params);
  }
}
