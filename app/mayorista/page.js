"use client";

import { useState, useEffect } from "react";
import { FaBoxOpen, FaIndustry } from "react-icons/fa";
import { MINIMO_MAYORISTA } from "@/lib/mayorista";
import MayoristaStock from "./_components/MayoristaStock";
import MayoristaEncargo from "./_components/MayoristaEncargo";

// Sección mayorista con dos modalidades: stock (entrega inmediata) y pedido a
// medida (encargo a fábrica). /mayorista#encargo abre directo la segunda.
const OPCIONES = [
  {
    id: "stock", icon: FaBoxOpen, titulo: "Mayorista Stock",
    texto: `Camisetas disponibles para entrega inmediata. Mínimo ${MINIMO_MAYORISTA}, combinando modelos y talles. Se abona el 100%.`,
  },
  {
    id: "encargo", icon: FaIndustry, titulo: "Pedido a medida",
    texto: `Elegís del catálogo, con la personalización que quieras. Mínimo ${MINIMO_MAYORISTA}. Seña del 60% y demora de 2 meses aprox.`,
  },
];

export default function MayoristaPage() {
  const [modo,  setModo]  = useState("stock");
  const [dolar, setDolar] = useState(null);   // { compra, venta, actualizado } | { error }

  useEffect(() => {
    if (window.location.hash === "#encargo") setModo("encargo");
    fetch("/api/dolar-blue").then((r) => r.json()).then(setDolar).catch(() => setDolar({ error: true }));
  }, []);

  function elegir(id) {
    setModo(id);
    history.replaceState(null, "", id === "encargo" ? "#encargo" : window.location.pathname);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 pb-40">
      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">MAYORISTA</h1>
      <p className="text-gray-600 mt-1 mb-6">Comprá por cantidad con precio especial en dólares.</p>

      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        {OPCIONES.map(({ id, icon: Icon, titulo, texto }) => (
          <button
            key={id}
            onClick={() => elegir(id)}
            className={`text-left rounded-xl p-4 border-2 transition-colors ${modo === id ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-400"}`}
          >
            <p className="flex items-center gap-2 font-bold text-gray-900">
              <Icon className={modo === id ? "text-orange-500" : "text-gray-400"} /> {titulo}
            </p>
            <p className="text-sm text-gray-600 mt-1">{texto}</p>
          </button>
        ))}
      </div>

      {modo === "stock" ? <MayoristaStock dolar={dolar} /> : <MayoristaEncargo dolar={dolar} />}
    </main>
  );
}
