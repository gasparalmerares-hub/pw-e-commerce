"use client";

import { useState, useEffect } from "react";
import { FaSpinner, FaWhatsapp, FaEnvelope } from "react-icons/fa";

// Carritos abandonados (ver lib/carritos.js y /api/admin/carritos): gente que
// dejó sus datos o fue a pagar y no terminó. Desde acá se le escribe por
// WhatsApp con un mensaje ya armado. "Contactado" se guarda en el servidor
// (POST /api/admin/carritos), así se ve igual en el celular y en la compu.
// A quien dejó su mail le llega además un recordatorio automático una vez
// (lib/recordatorioCarrito.js); acá se ve como "Le llegó el mail".

const TIPOS = {
  datos:         "Dejó sus datos y no pagó",
  mercadopago:   "Fue a Mercado Pago y no pagó",
  transferencia: "Eligió transferencia y no pagó",
};

// Donde se guardaban las marcas antes (solo en cada navegador): al abrir la
// página se suben al servidor una vez y se borran de acá.
const STORAGE_VIEJO = "zeus_carritos_contactados";

function guardarContactado(ids, contactado) {
  return fetch("/api/admin/carritos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, contactado }),
  }).then((r) => (r.ok ? r.json() : Promise.reject()));
}

function pesos(n) {
  return "$" + Number(n || 0).toLocaleString("es-AR");
}

function fecha(iso) {
  return new Date(iso).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// "IRLANDA 2024 LOCAL" → "Irlanda 2024 Local"
function titulo(s) {
  return String(s ?? "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function primerNombre(nombre) {
  return titulo(String(nombre ?? "").trim().split(/\s+/)[0] ?? "");
}

function mensaje(c) {
  const productos = c.productos.map((p) => titulo(p.nombre)).join(", ");
  const hola = `Hola${c.nombre ? " " + primerNombre(c.nombre) : ""}! ¿Cómo andás? Soy Gaspar de Camisetas Zeus 🏉`;
  const cuerpo = c.tipo === "transferencia"
    ? `Vi que elegiste pagar por transferencia tu pedido${productos ? ` (${productos})` : ""} y todavía no nos llegó el comprobante. ¿Pudiste hacerla? Si necesitás los datos de nuevo, avisame.`
    : `Vi que te quedó pendiente tu pedido${productos ? ` (${productos})` : ""}. ¿Pudiste completarlo? Si tuviste algún problema con el pago o preferís pagar por transferencia, avisame y te ayudo.`;
  return `${hola}\n\n${cuerpo}\n\n¡Abrazo!`;
}

export default function CarritosPage() {
  const [carritos,     setCarritos]     = useState(null);
  const [error,        setError]        = useState(null);
  const [verCompraron, setVerCompraron] = useState(false);
  const [contactados,  setContactados]  = useState({});

  useEffect(() => {
    fetch("/api/admin/carritos", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (d) => {
        if (!Array.isArray(d)) { setError(d.error || "No se pudieron cargar"); return; }
        const delServidor = Object.fromEntries(d.filter((c) => c.contactado).map((c) => [c.id, true]));
        // Marcas viejas de este navegador que el servidor todavía no tiene
        let viejas = [];
        try { viejas = Object.entries(JSON.parse(localStorage.getItem(STORAGE_VIEJO) || "{}")).filter(([id, v]) => v && !delServidor[id]).map(([id]) => id); } catch {}
        if (viejas.length) {
          try {
            await guardarContactado(viejas, true);
            viejas.forEach((id) => { delServidor[id] = true; });
            localStorage.removeItem(STORAGE_VIEJO);
          } catch {}
        } else {
          try { localStorage.removeItem(STORAGE_VIEJO); } catch {}
        }
        setContactados(delServidor);
        setCarritos(d);
      })
      .catch(() => setError("No se pudieron cargar"));
  }, []);

  function marcar(id, valor) {
    const antes = contactados;
    setContactados({ ...contactados, [id]: valor });
    guardarContactado([id], valor).catch(() => {
      setContactados(antes);
      alert("No se pudo guardar. Revisá la conexión y probá de nuevo.");
    });
  }

  const lista = (carritos ?? []).filter((c) => verCompraron || !c.yaCompro);
  const compraron = (carritos ?? []).filter((c) => c.yaCompro).length;
  const montoPendiente = lista.filter((c) => !c.yaCompro).reduce((s, c) => s + c.total, 0);

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Carritos abandonados</h1>
      <p className="text-sm text-gray-500 mb-6">
        Gente que dejó sus datos o fue a pagar y no terminó la compra (últimos 90 días). Escribiles por WhatsApp con el mensaje ya armado.
        A los que dejaron su mail, la web les manda sola un recordatorio al día siguiente (salvo que hayan elegido transferencia o ya los marques como contactados).
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!carritos && !error && <FaSpinner className="text-orange-500 text-2xl animate-spin" />}

      {carritos && (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 text-sm text-gray-700">
            <span><strong className="text-lg text-gray-900">{lista.filter((c) => !c.yaCompro).length}</strong> sin comprar</span>
            <span><strong className="text-lg text-gray-900">{pesos(montoPendiente)}</strong> en juego</span>
            {compraron > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={verCompraron} onChange={(e) => setVerCompraron(e.target.checked)} className="accent-orange-500" />
                Mostrar los {compraron} que ya compraron
              </label>
            )}
          </div>

          {lista.length === 0 && <p className="text-sm text-gray-500">No hay carritos abandonados.</p>}

          <div className="flex flex-col gap-3">
            {lista.map((c) => {
              const hecho = !!contactados[c.id];
              return (
                <div key={c.id} className={`bg-white border rounded-xl p-4 ${hecho || c.yaCompro ? "border-gray-200 opacity-60" : "border-gray-200"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-bold text-gray-900">{titulo(c.nombre) || "Sin nombre"}</p>
                    <p className="text-xs text-gray-500">{fecha(c.fecha)}{c.intentos > 1 ? ` · ${c.intentos} intentos` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold">{TIPOS[c.tipo]}</span>
                    {c.yaCompro && <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-800 font-semibold">Ya compró</span>}
                    {c.mailEnviado && <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">Le llegó el mail ({fecha(c.mailEnviado)})</span>}
                  </div>
                  <ul className="text-sm text-gray-700 mt-2">
                    {c.productos.map((p, i) => (
                      <li key={i}>{titulo(p.nombre)}{p.talle ? ` · T.${p.talle}` : ""}{p.cantidad > 1 ? ` x${p.cantidad}` : ""}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-gray-500 mt-1">
                    <strong className="text-gray-900">{pesos(c.total)}</strong>
                    {c.lugar ? ` · ${c.lugar}` : ""}{c.telefono ? ` · ${c.telefono}` : ""}{c.email ? ` · ${c.email}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    {c.whatsapp && (
                      <a href={`https://wa.me/${c.whatsapp}?text=${encodeURIComponent(mensaje(c))}`} target="_blank" rel="noopener noreferrer"
                        onClick={() => marcar(c.id, true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                        <FaWhatsapp /> Escribir por WhatsApp
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}?subject=${encodeURIComponent("Tu pedido en Camisetas Zeus")}&body=${encodeURIComponent(mensaje(c))}`}
                        onClick={() => marcar(c.id, true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-800 text-sm font-semibold hover:bg-gray-200">
                        <FaEnvelope /> Mail
                      </a>
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-auto">
                      <input type="checkbox" checked={hecho} onChange={(e) => marcar(c.id, e.target.checked)} className="accent-orange-500" />
                      Contactado
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
