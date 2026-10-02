"use client";

import { useState, useEffect } from "react";
import { FaCreditCard } from "react-icons/fa";
import { MAX_CUOTAS } from "@/lib/cuotas";

function formatearPrecio(n) {
  return "$" + Number(n).toLocaleString("es-AR");
}

// Tabla de cuotas con tarjeta de crédito para el precio de un producto, con
// las tasas reales de Mercado Pago (ver /api/cuotas). Si la consulta falla,
// muestra solo el máximo de cuotas, sin montos.
export default function CuotasMP({ precio }) {
  const [opciones, setOpciones] = useState(null);

  useEffect(() => {
    if (!precio) return;
    fetch(`/api/cuotas?monto=${precio}`)
      .then((r) => r.json())
      .then((d) => setOpciones(Array.isArray(d.opciones) ? d.opciones : []))
      .catch(() => setOpciones([]));
  }, [precio]);

  const enCuotas = (opciones ?? []).filter((o) => o.cuotas > 1);

  return (
    <div className="border border-gray-200 rounded-xl bg-white px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <FaCreditCard className="text-orange-500" />
        Hasta {MAX_CUOTAS} cuotas con tarjeta de crédito
      </p>

      {opciones === null ? (
        <div className="mt-2 flex flex-col gap-1.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : enCuotas.length > 0 && (
        <>
          <ul className="mt-2 flex flex-col gap-1.5">
            {enCuotas.map((o) => {
              const varia = o.hasta > o.desde;
              return (
                <li key={o.cuotas} className="text-sm text-gray-700 flex flex-wrap items-baseline gap-x-2">
                  <span>
                    <strong>{o.cuotas} cuotas</strong>
                    {o.sinInteres ? " sin interés" : ""} {varia ? "desde " : "de "}
                    <strong className={o.sinInteres ? "text-green-700" : "text-gray-900"}>{formatearPrecio(o.desde)}</strong>
                  </span>
                  {!o.sinInteres && (
                    <span className="text-xs text-gray-400">
                      Total {varia ? "desde " : ""}{formatearPrecio(o.totalDesde)}{o.cft ? ` · CFT ${o.cft}%` : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-gray-400 leading-snug">
            Valores informados por Mercado Pago. El monto final depende de tu tarjeta y banco.
          </p>
        </>
      )}
    </div>
  );
}
