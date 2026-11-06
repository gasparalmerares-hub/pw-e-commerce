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
