"use client";

import { useState, useEffect } from "react";
import { FaSpinner, FaPlus, FaTrash } from "react-icons/fa";
import { normalizarCodigo } from "@/lib/codigos";

// Admin → Configuración → Códigos de descuento (ver lib/codigos.js y
// lib/codigosServidor.js). Cada código es un % sobre las camisetas, que se
// suma al de transferencia. Se puede apagar, ponerle vencimiento y un máximo
// de usos (cuentan solo los pedidos pagados).

const inputClass =
  "bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors w-full";

const NUEVO = { codigo: "", porcentaje: "", vence: "", maxUsos: "" };

function fecha(iso) {
  const [a, m, d] = String(iso).split("-");
  return `${d}/${m}/${a}`;
}

function estado(c) {
  if (!c.activo) return { texto: "Apagado", clase: "bg-gray-200 text-gray-700" };
  if (c.vencido) return { texto: "Vencido", clase: "bg-red-100 text-red-700" };
  if (c.maxUsos && c.usos >= c.maxUsos) return { texto: "Agotado", clase: "bg-red-100 text-red-700" };
  return { texto: "Activo", clase: "bg-green-100 text-green-800" };
}

export default function CodigosDescuento() {
  const [codigos,   setCodigos]   = useState(null);
  const [nuevo,     setNuevo]     = useState(NUEVO);
  const [guardando, setGuardando] = useState(null);
  const [error,     setError]     = useState(null);

  async function cargar() {
    try {
      const d = await fetch("/api/admin/codigos", { cache: "no-store" }).then((r) => r.json());
      if (!Array.isArray(d)) throw new Error(d.error);
      setCodigos(d);
    } catch {
      setError("No se pudieron cargar los códigos.");
    }
  }

  useEffect(() => { cargar(); }, []);

  async function enviar(cuerpo, clave) {
    setGuardando(clave);
    setError(null);
    try {
      const r = await fetch("/api/admin/codigos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
      await cargar();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setGuardando(null);
    }
  }

  async function crear(e) {
    e.preventDefault();
    const codigo = normalizarCodigo(nuevo.codigo);
    if (codigos?.some((c) => c.codigo === codigo)) {
      setError(`Ya existe el código ${codigo}.`);
      return;
    }
    const ok = await enviar({ accion: "guardar", ...nuevo, codigo, activo: true }, "nuevo");
    if (ok) setNuevo(NUEVO);
  }

  function prenderApagar(c) {
    enviar({ accion: "guardar", codigo: c.codigo, porcentaje: c.porcentaje, vence: c.vence, maxUsos: c.maxUsos, activo: !c.activo }, c.codigo);
  }

  function borrar(c) {
    if (!window.confirm(`¿Borrar el código ${c.codigo}? Los pedidos que ya lo usaron no cambian.`)) return;
    enviar({ accion: "borrar", codigo: c.codigo }, c.codigo);
  }

  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-4 mt-6">
      <div>
        <h2 className="text-base font-bold text-gray-900">Códigos de descuento</h2>
        <p className="text-xs text-gray-500 mt-1">
          El cliente lo escribe en Finalizar compra. Es un porcentaje sobre las camisetas (no sobre el envío ni los parches) y se suma al descuento por transferencia.
        </p>
      </div>

      <form onSubmit={crear} className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <span className="text-xs text-gray-600">Código *</span>
          <input
            required value={nuevo.codigo} placeholder="ZEUS10"
            onChange={(e) => setNuevo({ ...nuevo, codigo: normalizarCodigo(e.target.value) })}
            className={`${inputClass} uppercase`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">Descuento % *</span>
          <input
            required type="number" min="1" max="90" value={nuevo.porcentaje} placeholder="10"
            onChange={(e) => setNuevo({ ...nuevo, porcentaje: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-600">Usos máximos</span>
          <input
            type="number" min="1" value={nuevo.maxUsos} placeholder="Sin límite"
            onChange={(e) => setNuevo({ ...nuevo, maxUsos: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <span className="text-xs text-gray-600">Vence el (opcional)</span>
          <input
            type="date" value={nuevo.vence}
            onChange={(e) => setNuevo({ ...nuevo, vence: e.target.value })}
            className={inputClass}
          />
        </label>
        <button
          type="submit" disabled={guardando === "nuevo"}
          className="col-span-2 sm:col-span-4 flex items-center justify-center gap-2 bg-orange-500 text-black font-bold py-2.5 rounded-xl hover:bg-orange-400 transition-colors disabled:opacity-50"
        >
          {guardando === "nuevo" ? <FaSpinner className="animate-spin" /> : <FaPlus />}
          Crear código
        </button>
      </form>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {codigos === null ? (
        <div className="flex justify-center py-4"><FaSpinner className="text-orange-500 text-xl animate-spin" /></div>
      ) : codigos.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no creaste ningún código.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-200 border border-gray-200 rounded-xl">
          {codigos.map((c) => {
            const e = estado(c);
            return (
              <li key={c.codigo} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="flex-1 min-w-[10rem]">
                  <p className="font-bold text-gray-900">
                    {c.codigo} <span className="text-orange-500">−{c.porcentaje}%</span>
                    <span className={`ml-2 align-middle px-2 py-0.5 rounded-full text-xs font-semibold ${e.clase}`}>{e.texto}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Usado {c.usos} {c.usos === 1 ? "vez" : "veces"}{c.maxUsos ? ` de ${c.maxUsos}` : ""}
                    {c.vence ? ` · vence el ${fecha(c.vence)}` : " · sin vencimiento"}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox" checked={!!c.activo} disabled={guardando === c.codigo}
                    onChange={() => prenderApagar(c)} className="w-5 h-5 accent-orange-500"
                  />
                  Activo
                </label>
                <button
                  type="button" onClick={() => borrar(c)} disabled={guardando === c.codigo}
                  aria-label={`Borrar ${c.codigo}`}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {guardando === c.codigo ? <FaSpinner className="animate-spin" /> : <FaTrash />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
