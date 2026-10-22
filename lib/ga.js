// Google Analytics 4 — mismo criterio que lib/fbpixel.js y lib/ttpixel.js:
// si no hay ID válido, todo es no-op. El ID no es secreto (va en la página).
// Las vistas de página las registra GA solo ("medición mejorada" cuenta los
// cambios de ruta de Next.js); acá van los eventos de compra, que se mandan
// desde lib/fbpixel.js junto con los de Meta y TikTok.

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-PG1T4EF6ED";
export const GA_ENABLED = /^G-[A-Z0-9]+$/.test(GA_ID);

export function gaEvent(name, params) {
  if (!GA_ENABLED || typeof window === "undefined" || typeof window.gtag !== "function") return;
  try {
    window.gtag("event", name, params);
  } catch (err) {
    console.warn("[ga] error:", err?.message);
  }
}

// [{ id, nombre, precio, cantidad, talle }] → formato "items" de GA4
export function gaItems(items) {
  return items.map((i) => ({
    item_id: String(i.id),
    ...(i.nombre ? { item_name: i.nombre } : {}),
    ...(i.talle ? { item_variant: String(i.talle) } : {}),
    price: Number(i.precio) || 0,
    quantity: Number(i.cantidad) || 1,
  }));
}
