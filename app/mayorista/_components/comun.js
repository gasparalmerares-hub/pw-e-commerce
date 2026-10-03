"use client";

import { useState, useEffect } from "react";
import { PROVINCIAS } from "@/lib/envio";
import { PRECIO_SUGERIDO_REVENTA, CARGA_ENCARGO, PRECIO_PERSONALIZACION_USD, SENA_ENCARGO } from "@/lib/mayorista";
import { puedeCompartirArchivos, compartirArchivos, descargarArchivos } from "@/lib/imagenCamiseta";
import { FaWhatsapp, FaDollarSign, FaSpinner, FaImages, FaDownload, FaCheckCircle, FaTimes } from "react-icons/fa";

// Los pedidos mayoristas van al WhatsApp personal del dueño, no al de la tienda
export const WHATSAPP_MAYORISTA = "5491131100949";

const ORDEN_TALLES = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "16", "18", "20", "22", "24", "26"];

export function pesos(n) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

export function ordenarTalles(talles) {
  return [...talles].sort((a, b) => {
    const ia = ORDEN_TALLES.indexOf(a), ib = ORDEN_TALLES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

export const inputClass =
  "bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors w-full";

// ─── Escalas de precio ──────────────────────────────────────────────────────

export function TablaEscalas({ escalas, activa, nota }) {
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="font-bold text-gray-900 mb-3">Precio por camiseta</h2>
      <div className={`grid gap-2 ${escalas.length > 3 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
        {[...escalas].reverse().map((e) => {
          const on = activa?.desde === e.desde;
          return (
            <div key={e.desde} className={`rounded-lg px-3 py-2 border ${on ? "border-orange-500 bg-orange-500 text-black" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
              {e.nombre && <p className="text-sm font-bold">{e.nombre}</p>}
              <p className="text-xs font-medium">Desde {e.desde} camisetas</p>
              <p className="text-lg font-extrabold">USD {e.precio} <span className="text-xs font-semibold">c/u</span></p>
            </div>
          );
        })}
      </div>
      {nota && <p className="text-xs text-gray-500 mt-3">{nota}</p>}
    </section>
  );
}

// ─── Dólar blue ─────────────────────────────────────────────────────────────

export function DolarBlue({ dolar, usdSugerido }) {
  const [usd, setUsd] = useState("");
  const base = Number(usd) || usdSugerido || 300;
  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-3"><FaDollarSign className="text-green-600" /> Dólar blue hoy</h2>
      {!dolar ? (
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
      ) : dolar.error ? (
        <p className="text-sm text-gray-500">No pudimos obtener la cotización en este momento.</p>
      ) : (
        <>
          <div className="flex gap-6">
            <div><p className="text-xs text-gray-500">Compra</p><p className="text-xl font-bold text-gray-900">{pesos(dolar.compra)}</p></div>
            <div><p className="text-xs text-gray-500">Venta</p><p className="text-xl font-bold text-green-700">{pesos(dolar.venta)}</p></div>
          </div>
          {dolar.actualizado && (
            <p className="text-xs text-gray-400 mt-1">
              Actualizado {new Date(dolar.actualizado).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-600">USD</span>
            <input
              type="number" min="0" inputMode="decimal" value={usd}
              onChange={(e) => setUsd(e.target.value)}
              placeholder={String(base)}
              className="w-28 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-orange-500"
            />
            <span className="text-sm text-gray-500">=</span>
            <span className="text-lg font-bold text-gray-900">{pesos(base * dolar.venta)}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Calculado con el dólar blue venta.</p>
        </>
      )}
    </section>
  );
}

// ─── Condiciones ────────────────────────────────────────────────────────────

export function textoCondiciones(tipo) {
  const pago = tipo === "encargo"
    ? [
        "Pedido a medida: elegís del catálogo los modelos que quieras, con la personalización que quieras.",
        `Los pedidos se consolidan hasta completar una carga de ${CARGA_ENCARGO} camisetas. La demora es de 2 meses aproximadamente y te avisamos personalmente cuando se despacha la carga.`,
        `Se abona una seña del ${SENA_ENCARGO * 100}% del total para confirmar y entrar en la carga; el saldo restante, al momento de la entrega. Sin la seña, el pedido no queda reservado.`,
        `Personalización: USD ${PRECIO_PERSONALIZACION_USD} por nombre y USD ${PRECIO_PERSONALIZACION_USD} por número.`,
      ]
    : ["Se abona el 100% al momento de la compra. Sin el pago, el pedido no queda reservado."];
  return [
    ...pago,
    `Precio mínimo de publicación: las camisetas no pueden publicarse ni promocionarse por debajo de ${pesos(PRECIO_SUGERIDO_REVENTA)} cada una, para cuidar las ventas minoristas y el mercado. Nos reservamos el derecho de continuar o no la relación comercial.`,
  ];
}

export function Condiciones({ tipo }) {
  return (
    <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-8">
      <h2 className="font-bold text-gray-900 mb-2">Condiciones</h2>
      <ul className="list-disc pl-5 text-sm text-gray-600 flex flex-col gap-1.5">
        {textoCondiciones(tipo).map((t) => <li key={t}>{t}</li>)}
      </ul>
    </section>
  );
}

// ─── Barra fija con el resumen ──────────────────────────────────────────────

export function BarraResumen({ children, boton, onClick, deshabilitado }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">{children}</div>
        <button
          onClick={onClick}
          disabled={deshabilitado}
          className="shrink-0 bg-green-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-green-500 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          {boton}
        </button>
      </div>
    </div>
  );
}

// ─── Datos del comprador + aceptación de condiciones ────────────────────────

export const FORM_VACIO = { nombre: "", celular: "", provincia: "", localidad: "", acepta: false };

export function validarDatos(form) {
  if (!form.nombre.trim() || !form.celular.trim() || !form.provincia || !form.localidad.trim()) return "Completá todos tus datos.";
  if (!form.acepta) return "Tenés que aceptar las condiciones mayoristas.";
  return null;
}

export function DatosComprador({ form, setForm, tipo }) {
  return (
    <>
      <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre y apellido / comercio" className={inputClass} />
      <input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} placeholder="Celular (con código de área)" inputMode="tel" className={inputClass} />
      <div className="grid grid-cols-2 gap-3">
        <select value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} className={`${inputClass} ${form.provincia ? "" : "text-gray-400"}`}>
          <option value="" disabled>Provincia</option>
          {PROVINCIAS.map((p) => <option key={p} value={p} className="text-gray-900">{p}</option>)}
        </select>
        <input value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} placeholder="Localidad" className={inputClass} />
      </div>
      <details className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
        <summary className="cursor-pointer font-semibold">Ver condiciones</summary>
        <ul className="list-disc pl-4 mt-2 flex flex-col gap-1">
          {textoCondiciones(tipo).map((t) => <li key={t}>{t}</li>)}
        </ul>
      </details>
      <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
        <input type="checkbox" checked={form.acepta} onChange={(e) => setForm({ ...form, acepta: e.target.checked })} className="mt-0.5 w-4 h-4 accent-orange-500 shrink-0" />
        Leí y acepto las condiciones mayoristas.
      </label>
    </>
  );
}

export function Modal({ titulo, onCerrar, children }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:px-4">
      <div className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4">
        {titulo && (
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
            <button type="button" onClick={onCerrar} className="text-gray-500 hover:text-gray-900"><FaTimes /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ─── Pedido registrado: mensaje y fotos por WhatsApp ────────────────────────

export function PedidoListo({ titulo, subtitulo, mensaje, fotos, onCerrar }) {
  const files = Array.isArray(fotos) ? fotos : [];
  const compartible = puedeCompartirArchivos(files);
  return (
    <Modal onCerrar={onCerrar}>
      <div className="text-center">
        <FaCheckCircle className="text-green-600 text-4xl mx-auto mb-2" />
        <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
        <p className="text-sm text-gray-600">{subtitulo}</p>
      </div>

      <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
        <p className="text-sm font-bold text-gray-900">Paso 1 · Mandanos el pedido</p>
        <a
          href={`https://wa.me/${WHATSAPP_MAYORISTA}?text=${encodeURIComponent(mensaje)}`}
          target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-500"
        >
          <FaWhatsapp className="text-lg" /> Enviar pedido por WhatsApp
        </a>
      </div>

      <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
        <p className="text-sm font-bold text-gray-900">Paso 2 · Mandanos las fotos</p>
        <p className="text-xs text-gray-500">Una foto por camiseta con el talle y el detalle. Compartilas en el mismo chat.</p>
        {fotos === "armando" ? (
          <p className="flex items-center gap-2 text-sm text-gray-500"><FaSpinner className="animate-spin" /> Preparando las fotos...</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {files.map((f) => <FotoPrevia key={f.name} file={f} />)}
            </div>
            {compartible && (
              <button onClick={() => compartirArchivos(files).catch(() => alert("No se pudo compartir. Probá con Descargar."))}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-500">
                <FaImages /> Compartir fotos por WhatsApp
              </button>
            )}
            <button onClick={() => descargarArchivos(files)}
              className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl ${compartible ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-green-600 text-white hover:bg-green-500"}`}>
              <FaDownload /> Descargar fotos
            </button>
          </>
        )}
      </div>

      <button onClick={onCerrar} className="text-sm text-gray-500 underline">Cerrar</button>
    </Modal>
  );
}

function FotoPrevia({ file }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <img src={url} alt={file.name} className="w-full rounded-lg border border-gray-200" /> : null;
}

// Datos del comprador para el final del mensaje de WhatsApp
export function pieMensaje(form) {
  return (
    `Nombre: ${form.nombre.trim()}\n` +
    `Celular: ${form.celular.trim()}\n` +
    `Localidad: ${form.localidad.trim()}, ${form.provincia}\n\n` +
    `Acepté las condiciones mayoristas.\n` +
    `Te mando las fotos de las camisetas a continuación.`
  );
}

// ─── Avance de la carga a fábrica (pedidos a medida) ────────────────────────

export function BarraCarga() {
  const [carga, setCarga] = useState(null);   // { actual, capacidad } | { error }

  useEffect(() => {
    fetch("/api/mayorista/carga").then((r) => r.json()).then(setCarga).catch(() => setCarga({ error: true }));
  }, []);

  if (!carga || carga.error) return null;
  const { actual, capacidad } = carga;
  const completa = actual >= capacidad;
  const pct = Math.min(100, Math.round((actual / capacidad) * 100));

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="font-bold text-gray-900">Carga actual a fábrica</h2>
        <p className="text-sm text-gray-700"><strong className="text-lg text-gray-900">{Math.min(actual, capacidad)}</strong> / {capacidad} camisetas</p>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${completa ? "bg-green-600" : "bg-orange-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {completa
          ? "¡Carga completa! Se despacha en estos días. Los pedidos nuevos entran en la próxima carga."
          : `Faltan ${capacidad - actual} camisetas para completar la carga. Cuando se completa, se despacha a fábrica (demora de 2 meses aprox.).`}
      </p>
    </section>
  );
}
