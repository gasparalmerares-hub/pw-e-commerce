"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { PROVINCIAS } from "@/lib/envio";
import { MINIMO_MAYORISTA, ESCALAS_MAYORISTA, precioMayoristaUSD, siguienteEscala } from "@/lib/mayorista";
import { armarImagenCamiseta, puedeCompartirArchivos, compartirArchivos, descargarArchivos } from "@/lib/imagenCamiseta";
import { FaWhatsapp, FaDollarSign, FaBoxOpen, FaClock, FaMinus, FaPlus, FaTimes, FaSpinner, FaImages, FaDownload, FaCheckCircle } from "react-icons/fa";

const WHATSAPP_ADMIN = "5492216220145";
const ORDEN_TALLES   = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL"];
const STORAGE_KEY    = "zeus_mayorista";

function pesos(n) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

function ordenarTalles(talles) {
  return [...talles].sort((a, b) => {
    const ia = ORDEN_TALLES.indexOf(a), ib = ORDEN_TALLES.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

const inputClass =
  "bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors w-full";

export default function MayoristaPage() {
  const [productos, setProductos] = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [dolar,     setDolar]     = useState(null);   // { compra, venta, actualizado } | { error }
  const [seleccion, setSeleccion] = useState({});     // { "id|talle": cantidad }
  const [paso,      setPaso]      = useState(null);   // null | "datos" | "listo"
  const [form,      setForm]      = useState({ nombre: "", celular: "", provincia: "", localidad: "" });
  const [enviando,  setEnviando]  = useState(false);
  const [error,     setError]     = useState(null);
  const [pedido,    setPedido]    = useState(null);   // respuesta de la API
  const [fotos,     setFotos]     = useState(null);   // File[] | "armando"
  const [usdCalc,   setUsdCalc]   = useState("");

  // Camisetas con stock (sin bucales), solo los talles que tienen unidades
  async function cargarProductos() {
    const { data } = await supabase.from("productos_stock").select("*").order("creado_at", { ascending: false });
    const conStock = (data ?? [])
      .filter((p) => (p.seccion ?? "camiseta") !== "bucal")
      .map((p) => ({
        ...p,
        tallesDisponibles: ordenarTalles((p.talle ?? []).filter((t) => Number(p.stock_por_talle?.[t]) > 0)),
      }))
      .filter((p) => p.tallesDisponibles.length > 0);
    setProductos(conStock);
    setCargando(false);
  }

  useEffect(() => {
    cargarProductos();
    fetch("/api/dolar-blue").then((r) => r.json()).then(setDolar).catch(() => setDolar({ error: true }));
    try { setSeleccion(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")); } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seleccion)); } catch {}
  }, [seleccion]);

  const porId = useMemo(() => new Map(productos.map((p) => [String(p.id), p])), [productos]);

  // Selección válida contra el stock actual (si algo se agotó, se ajusta solo)
  const lineas = Object.entries(seleccion)
    .map(([k, cantidad]) => {
      const [id, talle] = k.split("|");
      const p = porId.get(id);
      const stock = Number(p?.stock_por_talle?.[talle]) || 0;
      return p ? { k, id, talle, cantidad: Math.min(cantidad, stock), producto: p } : null;
    })
    .filter((l) => l && l.cantidad > 0);

  const cantidad   = lineas.reduce((s, l) => s + l.cantidad, 0);
  const precioUSD  = precioMayoristaUSD(cantidad);
  const precioRef  = precioUSD ?? ESCALAS_MAYORISTA[ESCALAS_MAYORISTA.length - 1].precio;
  const totalUSD   = cantidad * precioRef;
  const venta      = dolar?.venta ?? null;
  const proxima    = siguienteEscala(cantidad);
  const faltan     = Math.max(0, MINIMO_MAYORISTA - cantidad);

  function cambiar(id, talle, delta) {
    const p = porId.get(String(id));
    const stock = Number(p?.stock_por_talle?.[talle]) || 0;
    const k = `${id}|${talle}`;
    setSeleccion((prev) => {
      const n = Math.max(0, Math.min(stock, (prev[k] ?? 0) + delta));
      const next = { ...prev };
      if (n === 0) delete next[k]; else next[k] = n;
      return next;
    });
  }

  async function confirmarPedido(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.celular.trim() || !form.provincia || !form.localidad.trim()) {
      setError("Completá todos tus datos.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/pedidos/mayorista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lineas.map(({ id, talle, cantidad }) => ({ id, talle, cantidad })),
          comprador: form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) cargarProductos();
        throw new Error(data.error ?? "No se pudo registrar el pedido.");
      }
      setPedido(data);
      setPaso("listo");
      setSeleccion({});
      armarFotos(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // Una foto por modelo y talle, con el talle y la cantidad en grande
  async function armarFotos(items) {
    setFotos("armando");
    const files = [];
    for (const it of items) {
      files.push(await armarImagenCamiseta({
        imagen: it.imagen,
        lineas: [String(it.talle), it.cantidad > 1 ? `x${it.cantidad}` : "x1"],
        nombreArchivo: `mayorista-${String(files.length + 1).padStart(2, "0")}.jpg`,
      }));
    }
    setFotos(files);
  }

  function mensajeWhatsApp(p) {
    const detalle = p.items.map((i) => `• ${i.nombre.trim()} — Talle ${i.talle} x${i.cantidad}`).join("\n");
    return (
      `Hola! Quiero hacer un pedido *MAYORISTA* (stock) 🏉\n\n` +
      `*Pedido #${p.id.slice(0, 8)}*\n${detalle}\n\n` +
      `*Total: ${p.cantidad} camisetas*\n` +
      `Precio: USD ${p.precioUSD} c/u → *USD ${p.totalUSD}*\n` +
      `Dólar blue hoy (${pesos(p.dolar)}): *${pesos(p.totalARS)}*\n\n` +
      `Nombre: ${form.nombre.trim()}\n` +
      `Celular: ${form.celular.trim()}\n` +
      `Localidad: ${form.localidad.trim()}, ${form.provincia}\n\n` +
      `Te mando las fotos de las camisetas a continuación.`
    );
  }

  const files = Array.isArray(fotos) ? fotos : [];

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 pb-40">
      <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">MAYORISTA</h1>
      <p className="text-gray-600 mt-1 mb-6">Comprá por cantidad con precio especial en dólares.</p>

      {/* Opciones de mayoreo */}
      <div className="grid sm:grid-cols-2 gap-3 mb-8">
        <div className="border-2 border-orange-500 bg-orange-50 rounded-xl p-4">
          <p className="flex items-center gap-2 font-bold text-gray-900"><FaBoxOpen className="text-orange-500" /> Mayorista Stock</p>
          <p className="text-sm text-gray-600 mt-1">Camisetas disponibles para entrega inmediata. Mínimo {MINIMO_MAYORISTA} camisetas, combinando modelos y talles.</p>
        </div>
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 opacity-70">
          <p className="flex items-center gap-2 font-bold text-gray-900"><FaClock className="text-gray-400" /> Mayorista por encargo</p>
          <p className="text-sm text-gray-500 mt-1">Próximamente.</p>
        </div>
      </div>

      {/* Escalas de precio + dólar blue */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <section className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-bold text-gray-900 mb-3">Precio por camiseta</h2>
          <div className="grid grid-cols-2 gap-2">
            {[...ESCALAS_MAYORISTA].reverse().map((e) => {
              const activa = precioUSD === e.precio;
              return (
                <div key={e.desde} className={`rounded-lg px-3 py-2 border ${activa ? "border-orange-500 bg-orange-500 text-black" : "border-gray-200 bg-gray-50 text-gray-700"}`}>
                  <p className="text-xs font-medium">{e.desde}+ camisetas</p>
                  <p className="text-lg font-extrabold">USD {e.precio} <span className="text-xs font-semibold">c/u</span></p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-3">El precio se aplica a todas las camisetas del pedido según la cantidad total.</p>
        </section>

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
                  type="number" min="0" inputMode="decimal" value={usdCalc}
                  onChange={(e) => setUsdCalc(e.target.value)}
                  placeholder={String(totalUSD || 320)}
                  className="w-28 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-orange-500"
                />
                <span className="text-sm text-gray-500">=</span>
                <span className="text-lg font-bold text-gray-900">{pesos((Number(usdCalc) || totalUSD || 320) * dolar.venta)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Calculado con el dólar blue venta.</p>
            </>
          )}
        </section>
      </div>

      {/* Camisetas en stock */}
      <h2 className="text-xl font-bold text-gray-900 mb-1">Elegí tus camisetas</h2>
      <p className="text-sm text-gray-500 mb-4">Sumá unidades por talle. Podés combinar modelos.</p>

      {cargando ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-72 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : productos.length === 0 ? (
        <p className="text-center text-gray-500 py-16">No hay camisetas en stock en este momento.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {productos.map((p) => {
            const elegidas = p.tallesDisponibles.reduce((s, t) => s + (seleccion[`${p.id}|${t}`] ?? 0), 0);
            return (
              <article key={p.id} className={`bg-white rounded-xl border overflow-hidden flex flex-col ${elegidas ? "border-orange-500 ring-1 ring-orange-500" : "border-gray-200"}`}>
                <div className="h-36 sm:h-44 relative bg-[#f5f5f0]">
                  <Image src={p.imagen} alt={p.nombre} fill unoptimized className="object-contain mix-blend-multiply" sizes="(max-width: 1024px) 50vw, 25vw" />
                  {elegidas > 0 && (
                    <span className="absolute top-2 right-2 bg-orange-500 text-black text-xs font-bold rounded-full px-2 py-0.5">{elegidas}</span>
                  )}
                </div>
                <div className="p-3 flex flex-col gap-2 flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{p.nombre}</h3>
                  <div className="flex flex-col gap-1.5 mt-auto">
                    {p.tallesDisponibles.map((t) => {
                      const n = seleccion[`${p.id}|${t}`] ?? 0;
                      const stock = Number(p.stock_por_talle[t]);
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <span className="w-9 text-sm font-bold text-gray-800">{t}</span>
                          <span className="text-[11px] text-gray-400 flex-1">quedan {stock}</span>
                          <button onClick={() => cambiar(p.id, t, -1)} disabled={n === 0} aria-label={`Quitar talle ${t}`}
                            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center disabled:opacity-30 active:scale-95"><FaMinus className="text-[10px]" /></button>
                          <span className={`w-5 text-center text-sm font-bold ${n ? "text-orange-600" : "text-gray-400"}`}>{n}</span>
                          <button onClick={() => cambiar(p.id, t, 1)} disabled={n >= stock} aria-label={`Agregar talle ${t}`}
                            className="w-7 h-7 rounded-lg bg-orange-500 text-black flex items-center justify-center disabled:opacity-30 active:scale-95"><FaPlus className="text-[10px]" /></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Resumen fijo abajo */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-700">
              <strong>{cantidad}</strong> camiseta{cantidad !== 1 ? "s" : ""}
              {cantidad > 0 && <> · USD {precioRef} c/u</>}
            </p>
            <p className="text-lg font-extrabold text-gray-900 leading-tight">
              USD {totalUSD}
              {venta && cantidad > 0 && <span className="text-sm font-semibold text-gray-500"> ≈ {pesos(totalUSD * venta)}</span>}
            </p>
            <p className="text-xs text-orange-600 font-medium truncate">
              {faltan > 0
                ? `Te faltan ${faltan} para el mínimo de ${MINIMO_MAYORISTA}`
                : proxima ? `Sumá ${proxima.faltan} más y pagás USD ${proxima.precio} c/u` : "¡Tenés el mejor precio!"}
            </p>
          </div>
          <button
            onClick={() => { setError(null); setPaso("datos"); }}
            disabled={faltan > 0}
            className="shrink-0 bg-green-600 text-white font-bold px-5 py-3 rounded-xl hover:bg-green-500 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
          >
            Hacer pedido
          </button>
        </div>
      </div>

      {/* Datos del comprador */}
      {paso === "datos" && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:px-4">
          <form onSubmit={confirmarPedido} className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Tu pedido mayorista</h2>
              <button type="button" onClick={() => setPaso(null)} className="text-gray-500 hover:text-gray-900"><FaTimes /></button>
            </div>

            <ul className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
              {lineas.map((l) => (
                <li key={l.k} className="flex justify-between gap-2">
                  <span className="truncate">{l.producto.nombre} · T.{l.talle}</span>
                  <strong className="shrink-0">x{l.cantidad}</strong>
                </li>
              ))}
              <li className="flex justify-between border-t border-gray-200 pt-2 mt-1 font-bold text-gray-900">
                <span>{cantidad} camisetas × USD {precioRef}</span>
                <span>USD {totalUSD}</span>
              </li>
              {venta && (
                <li className="flex justify-between text-gray-500 text-xs">
                  <span>Dólar blue {pesos(venta)}</span>
                  <span>≈ {pesos(totalUSD * venta)}</span>
                </li>
              )}
            </ul>

            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre y apellido / comercio" className={inputClass} />
            <input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} placeholder="Celular (con código de área)" inputMode="tel" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} className={`${inputClass} ${form.provincia ? "" : "text-gray-400"}`}>
                <option value="" disabled>Provincia</option>
                {PROVINCIAS.map((p) => <option key={p} value={p} className="text-gray-900">{p}</option>)}
              </select>
              <input value={form.localidad} onChange={(e) => setForm({ ...form, localidad: e.target.value })} placeholder="Localidad" className={inputClass} />
            </div>

            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

            <button type="submit" disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-500 disabled:opacity-50">
              {enviando ? <FaSpinner className="animate-spin" /> : <FaWhatsapp className="text-lg" />}
              {enviando ? "Registrando..." : "Confirmar pedido"}
            </button>
            <p className="text-xs text-gray-500 text-center">El precio final en pesos se calcula con el dólar blue del día. Coordinamos el pago y el envío por WhatsApp.</p>
          </form>
        </div>
      )}

      {/* Pedido registrado: mandar mensaje y fotos */}
      {paso === "listo" && pedido && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:px-4">
          <div className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 flex flex-col gap-4">
            <div className="text-center">
              <FaCheckCircle className="text-green-600 text-4xl mx-auto mb-2" />
              <h2 className="text-lg font-bold text-gray-900">¡Pedido #{pedido.id.slice(0, 8)} registrado!</h2>
              <p className="text-sm text-gray-600">
                {pedido.cantidad} camisetas · <strong>USD {pedido.totalUSD}</strong> ({pesos(pedido.totalARS)} al blue de hoy)
              </p>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-sm font-bold text-gray-900">Paso 1 · Mandanos el pedido</p>
              <a
                href={`https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(mensajeWhatsApp(pedido))}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-500"
              >
                <FaWhatsapp className="text-lg" /> Enviar pedido por WhatsApp
              </a>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
              <p className="text-sm font-bold text-gray-900">Paso 2 · Mandanos las fotos</p>
              <p className="text-xs text-gray-500">Una foto por camiseta con el talle y la cantidad. Compartilas en el mismo chat.</p>
              {fotos === "armando" ? (
                <p className="flex items-center gap-2 text-sm text-gray-500"><FaSpinner className="animate-spin" /> Preparando las fotos...</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {files.map((f) => <FotoPrevia key={f.name} file={f} />)}
                  </div>
                  {puedeCompartirArchivos(files) && (
                    <button onClick={() => compartirArchivos(files).catch(() => alert("No se pudo compartir. Probá con Descargar."))}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-500">
                      <FaImages /> Compartir fotos por WhatsApp
                    </button>
                  )}
                  <button onClick={() => descargarArchivos(files)}
                    className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl ${puedeCompartirArchivos(files) ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-green-600 text-white hover:bg-green-500"}`}>
                    <FaDownload /> Descargar fotos
                  </button>
                </>
              )}
            </div>

            <button onClick={() => { setPaso(null); setPedido(null); setFotos(null); }} className="text-sm text-gray-500 underline">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </main>
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
