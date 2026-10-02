"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { MINIMO_MAYORISTA, ESCALAS_STOCK, precioPorEscala, siguienteEscala, formatoUSD } from "@/lib/mayorista";
import { armarImagenCamiseta } from "@/lib/imagenCamiseta";
import { FaMinus, FaPlus, FaSpinner, FaWhatsapp } from "react-icons/fa";
import {
  pesos, ordenarTalles, TablaEscalas, DolarBlue, Condiciones, BarraResumen, DatosComprador,
  FORM_VACIO, validarDatos, Modal, PedidoListo, pieMensaje,
} from "./comun";

const STORAGE_KEY = "zeus_mayorista";

// Mayorista Stock: el cliente arma el pedido con camisetas en stock (por talle,
// sin pasarse de lo disponible) y paga el 100% antes de que se reserve.
export default function MayoristaStock({ dolar }) {
  const [productos, setProductos] = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [seleccion, setSeleccion] = useState({});     // { "id|talle": cantidad }
  const [paso,      setPaso]      = useState(null);   // null | "datos" | "listo"
  const [form,      setForm]      = useState(FORM_VACIO);
  const [enviando,  setEnviando]  = useState(false);
  const [error,     setError]     = useState(null);
  const [pedido,    setPedido]    = useState(null);
  const [fotos,     setFotos]     = useState(null);   // File[] | "armando"

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

  const cantidad  = lineas.reduce((s, l) => s + l.cantidad, 0);
  const escala    = precioPorEscala(ESCALAS_STOCK, cantidad);
  const precioRef = (escala ?? ESCALAS_STOCK[ESCALAS_STOCK.length - 1]).precio;
  const totalUSD  = cantidad * precioRef;
  const venta     = dolar?.venta ?? null;
  const proxima   = siguienteEscala(ESCALAS_STOCK, cantidad);
  const faltan    = Math.max(0, MINIMO_MAYORISTA - cantidad);

  function cambiar(id, talle, delta) {
    const stock = Number(porId.get(String(id))?.stock_por_talle?.[talle]) || 0;
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
    const invalido = validarDatos(form);
    if (invalido) { setError(invalido); return; }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/pedidos/mayorista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "stock", items: lineas.map(({ id, talle, cantidad }) => ({ id, talle, cantidad })), comprador: form }),
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
        lineas: [String(it.talle), `x${it.cantidad}`],
        nombreArchivo: `mayorista-${String(files.length + 1).padStart(2, "0")}.jpg`,
      }));
    }
    setFotos(files);
  }

  function mensajeWhatsApp(p) {
    const detalle = p.items.map((i) => `• ${i.nombre.trim()} — Talle ${i.talle} x${i.cantidad}`).join("\n");
    return (
      `Hola! Quiero hacer un pedido *MAYORISTA STOCK* 🏉\n\n` +
      `*Pedido #${p.id.slice(0, 8)}*\n${detalle}\n\n` +
      `*Total: ${p.cantidad} camisetas*\n` +
      `Precio: USD ${p.precioUSD} c/u → *${formatoUSD(p.totalUSD)}*\n` +
      `Dólar blue hoy (${pesos(p.dolar)}): *${pesos(p.totalARS)}*\n` +
      `Pago: 100% para reservar.\n\n` +
      pieMensaje(form)
    );
  }

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <TablaEscalas escalas={ESCALAS_STOCK} activa={escala} nota="El precio se aplica a todas las camisetas del pedido según la cantidad total." />
        <DolarBlue dolar={dolar} usdSugerido={totalUSD} />
      </div>
      <Condiciones tipo="stock" />

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
                  {elegidas > 0 && <span className="absolute top-2 right-2 bg-orange-500 text-black text-xs font-bold rounded-full px-2 py-0.5">{elegidas}</span>}
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
                          <Stepper n={n} max={stock} talle={t} onMenos={() => cambiar(p.id, t, -1)} onMas={() => cambiar(p.id, t, 1)} />
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

      <BarraResumen boton="Hacer pedido" deshabilitado={faltan > 0} onClick={() => { setError(null); setPaso("datos"); }}>
        <p className="text-sm text-gray-700"><strong>{cantidad}</strong> camiseta{cantidad !== 1 ? "s" : ""}{cantidad > 0 && <> · USD {precioRef} c/u</>}</p>
        <p className="text-lg font-extrabold text-gray-900 leading-tight">
          {formatoUSD(totalUSD)}
          {venta && cantidad > 0 && <span className="text-sm font-semibold text-gray-500"> ≈ {pesos(totalUSD * venta)}</span>}
        </p>
        <p className="text-xs text-orange-600 font-medium truncate">
          {faltan > 0 ? `Te faltan ${faltan} para el mínimo de ${MINIMO_MAYORISTA}`
            : proxima ? `Sumá ${proxima.faltan} más y pagás USD ${proxima.precio} c/u` : "¡Tenés el mejor precio!"}
        </p>
      </BarraResumen>

      {paso === "datos" && (
        <Modal titulo="Tu pedido mayorista" onCerrar={() => setPaso(null)}>
          <form onSubmit={confirmarPedido} className="flex flex-col gap-4">
            <ul className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
              {lineas.map((l) => (
                <li key={l.k} className="flex justify-between gap-2">
                  <span className="truncate">{l.producto.nombre} · T.{l.talle}</span>
                  <strong className="shrink-0">x{l.cantidad}</strong>
                </li>
              ))}
              <li className="flex justify-between border-t border-gray-200 pt-2 mt-1 font-bold text-gray-900">
                <span>{cantidad} camisetas × USD {precioRef}</span>
                <span>{formatoUSD(totalUSD)}</span>
              </li>
              {venta && (
                <li className="flex justify-between text-gray-500 text-xs">
                  <span>Dólar blue {pesos(venta)}</span>
                  <span>≈ {pesos(totalUSD * venta)}</span>
                </li>
              )}
            </ul>
            <DatosComprador form={form} setForm={setForm} tipo="stock" />
            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-500 disabled:opacity-50">
              {enviando ? <FaSpinner className="animate-spin" /> : <FaWhatsapp className="text-lg" />}
              {enviando ? "Registrando..." : "Confirmar pedido"}
            </button>
            <p className="text-xs text-gray-500 text-center">El precio final en pesos se calcula con el dólar blue del día. Coordinamos el pago y el envío por WhatsApp.</p>
          </form>
        </Modal>
      )}

      {paso === "listo" && pedido && (
        <PedidoListo
          titulo={`¡Pedido #${pedido.id.slice(0, 8)} registrado!`}
          subtitulo={`${pedido.cantidad} camisetas · ${formatoUSD(pedido.totalUSD)} (${pesos(pedido.totalARS)} al blue de hoy)`}
          mensaje={mensajeWhatsApp(pedido)}
          fotos={fotos}
          onCerrar={() => { setPaso(null); setPedido(null); setFotos(null); }}
        />
      )}
    </>
  );
}

export function Stepper({ n, max, talle, onMenos, onMas }) {
  return (
    <>
      <button onClick={onMenos} disabled={n === 0} aria-label={`Quitar talle ${talle}`}
        className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center disabled:opacity-30 active:scale-95"><FaMinus className="text-[10px]" /></button>
      <span className={`w-5 text-center text-sm font-bold ${n ? "text-orange-600" : "text-gray-400"}`}>{n}</span>
      <button onClick={onMas} disabled={n >= max} aria-label={`Agregar talle ${talle}`}
        className="w-7 h-7 rounded-lg bg-orange-500 text-black flex items-center justify-center disabled:opacity-30 active:scale-95"><FaPlus className="text-[10px]" /></button>
    </>
  );
}
