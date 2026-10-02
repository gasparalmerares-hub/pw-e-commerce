// Cotización del dólar blue (dolarapi.com, gratuita y sin clave). Se cachea
// 1 hora en el servidor: los precios mayoristas se pasan a pesos con la venta.
export async function getDolarBlue() {
  const res = await fetch("https://dolarapi.com/v1/dolares/blue", { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`dolarapi respondió ${res.status}`);
  const d = await res.json();
  const venta = Number(d.venta);
  if (!Number.isFinite(venta) || venta <= 0) throw new Error("Cotización inválida");
  return { compra: Number(d.compra), venta, actualizado: d.fechaActualizacion ?? null };
}
