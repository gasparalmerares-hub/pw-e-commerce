// TikTok Pixel — mismo criterio que lib/fbpixel.js: si no hay ID válido,
// todas las funciones son no-op y el sitio funciona igual.
// El ID del píxel no es secreto: aparece en el código de cualquier página.
// Los eventos se mandan desde lib/fbpixel.js, junto con los de Meta.

// Píxel "Camisetas Zeus Web" de la cuenta Camisetaszeus_adv.
export const TT_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "DB2J553C77UA626EHHE0";
export const TT_PIXEL_ENABLED = /^[A-Z0-9]{10,}$/.test(TT_PIXEL_ID);

export function ttTrack(event, params, eventId) {
  if (!TT_PIXEL_ENABLED) return;
  if (typeof window === "undefined") return;
  if (!window.ttq || typeof window.ttq.track !== "function") return;
  try {
    if (eventId) window.ttq.track(event, params, { event_id: eventId });
    else window.ttq.track(event, params);
  } catch (err) {
    console.warn("[ttpixel] error:", err?.message);
  }
}

export function ttPage() {
  if (!TT_PIXEL_ENABLED || typeof window === "undefined" || !window.ttq?.page) return;
  try { window.ttq.page(); } catch {}
}

// [{ id, cantidad, precio }] → formato "contents" de TikTok
export function ttContents(items) {
  return items.map((i) => ({
    content_id: String(i.id),
    content_type: "product",
    quantity: Number(i.cantidad) || 1,
    ...(i.precio != null ? { price: Number(i.precio) || 0 } : {}),
  }));
}
