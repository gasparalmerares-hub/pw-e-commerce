"use client";

import { useState, useEffect } from "react";
import { FaTruck } from "react-icons/fa";
import { envioDesde } from "@/lib/envio";

// "Envío a todo el país: $10.000" en la página del producto y en el carrito,
// para que el costo del envío no sea una sorpresa en Finalizar compra. Lee el
// precio de /api/config (el mismo que cobra el checkout).
export default function EnvioInfo({ className = "text-sm" }) {
  const [envio, setEnvio] = useState(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setEnvio(envioDesde(d)))
      .catch(() => {});
  }, []);

  if (!envio?.precio) return null;
  return (
    <p className={`flex items-center gap-2 text-gray-600 ${className}`}>
      <FaTruck className="text-orange-500 shrink-0" />
      <span>
        Envío a todo el país: <strong className="text-gray-900">{envio.varia ? "desde " : ""}${envio.precio.toLocaleString("es-AR")}</strong>
      </span>
    </p>
  );
}
