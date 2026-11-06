"use client";

import { useEffect, useState } from "react";

// Precio tachado de Stock: uno solo para toda la sección, guardado en
// configuracion (clave precio_tachado_stock, ej. "88800"). Se muestra en las
// camisetas de Stock que cuestan al menos un 5% menos, así no aparece en las
// que valen casi lo mismo (como las estampadas).

export function usePrecioTachadoStock() {
  const [tachado, setTachado] = useState(0);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => setTachado(Number(c?.precio_tachado_stock) || 0))
      .catch(() => {});
  }, []);
  return tachado;
}

export function tachadoPara(precio, tachado) {
  return tachado > 0 && Number(precio) <= tachado * 0.95 ? tachado : null;
}

// Porcentaje de rebaja contra el precio tachado (redondeado hacia abajo para
// no prometer de más). null si no corresponde mostrar tachado.
export function descuentoPct(precio, tachado) {
  if (!tachadoPara(precio, tachado)) return null;
  return Math.floor(((tachado - Number(precio)) / tachado) * 100);
}

// El mayor descuento pagando por transferencia, contra el precio tachado
// (para el "hasta X% OFF" del inicio), redondeado hacia abajo de a 5
// (21% → 20%, como pidió el dueño).
export function maxDescuentoTransferencia(productos, tachado) {
  let max = 0;
  for (const p of productos ?? []) {
    if (!tachadoPara(p.precio, tachado)) continue;
    const transf = Number(p.precio) * (1 - (Number(p.descuento_transferencia) || 0) / 100);
    max = Math.max(max, Math.floor(((tachado - transf) / tachado) * 100));
  }
  return Math.floor(max / 5) * 5 || null;
}
