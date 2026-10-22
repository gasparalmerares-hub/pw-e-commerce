"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import {
  MINIMO_MAYORISTA, ESCALAS_ENCARGO, PRECIO_PERSONALIZACION_USD, SENA_ENCARGO,
  precioPorEscala, siguienteEscala, cantidadPersonalizaciones, redondearUSD, formatoUSD,
} from "@/lib/mayorista";
import { textoPersonalizacion } from "@/lib/personalizacion";
import { armarImagenCamiseta } from "@/lib/imagenCamiseta";
import { FaSpinner, FaWhatsapp } from "react-icons/fa";
import {
  pesos, ordenarTalles, inputClass, TablaEscalas, DolarBlue, Condiciones, BarraResumen, DatosComprador,
  FORM_VACIO, validarDatos, Modal, PedidoListo, pieMensaje,
} from "./comun";
import { Stepper } from "./MayoristaStock";

const STORAGE_KEY = "zeus_mayorista_encargo";
const MAX_POR_TALLE = 50;

// Mayorista por encargo ("pedido a medida"): modelos del catálogo, sin límite
// de stock, con personalización por camiseta. Se fabrica en una carga
// consolidada: seña del 60% para confirmar y saldo a la entrega.
export default function MayoristaEncargo({ dolar }) {
  const [productos, setProductos] = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [seccion,   setSeccion]   = useState("adultos");
  const [busqueda,  setBusqueda]  = useState("");
  const [visible,   setVisible]   = useState(24);
  const [seleccion, setSeleccion] = useState({});   // { "id|talle": cantidad }
  const [pers,      setPers]      = useState({});   // { "id|talle#unidad": { nombre, numero } }
  const [paso,      setPaso]      = useState(null); // null | "revisar" | "listo"
  const [form,      setForm]      = useState(FORM_VACIO);
  const [enviando,  setEnviando]  = useState(false);
  const [error,     setError]     = useState(null);
  const [pedido,    setPedido]    = useState(null);
  const [fotos,     setFotos]     = useState(null);

  useEffect(() => {
    supabase.from("productos_catalogo").select("*").order("creado_at", { ascending: false })
      .then(({ data }) => { setProductos(data ?? []); setCargando(false); });
    try {
      const guardado = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      setSeleccion(guardado.seleccion ?? {});
      setPers(guardado.pers ?? {});
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ seleccion, pers })); } catch {}
  }, [seleccion, pers]);

  const porId = useMemo(() => new Map(productos.map((p) => [String(p.id), p])), [productos]);

  const filtrados = productos.filter((p) =>
    ((p.seccion === "kids") === (seccion === "kids")) &&
    (!busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  // Líneas del pedido (modelo + talle) con la personalización de cada unidad
  const lineas = Object.entries(seleccion)
    .map(([k, cantidad]) => {
      const [id, talle] = k.split("|");
      const p = porId.get(id);
      if (!p || !(p.talle ?? []).includes(talle) || cantidad <= 0) return null;
      const unidades = Array.from({ length: cantidad }, (_, u) => {
        const v = pers[`${k}#${u}`];
        return v && (v.nombre?.trim() || v.numero?.trim()) ? { nombre: v.nombre ?? "", numero: v.numero ?? "" } : null;
      });
      return { k, id, talle, cantidad, producto: p, unidades };
    })
    .filter(Boolean);

  const cantidad  = lineas.reduce((s, l) => s + l.cantidad, 0);
  const escala    = precioPorEscala(ESCALAS_ENCARGO, cantidad);
  const precioRef = (escala ?? ESCALAS_ENCARGO[ESCALAS_ENCARGO.length - 1]).precio;
  const extras    = cantidadPersonalizaciones(lineas.flatMap((l) => l.unidades));
  const totalUSD  = cantidad * precioRef + extras * PRECIO_PERSONALIZACION_USD;
  const senaUSD   = redondearUSD(totalUSD * SENA_ENCARGO);
  const saldoUSD  = redondearUSD(totalUSD - senaUSD);
  const venta     = dolar?.venta ?? null;
  const proxima   = siguienteEscala(ESCALAS_ENCARGO, cantidad);
  const faltan    = Math.max(0, MINIMO_MAYORISTA - cantidad);

  function cambiar(id, talle, delta) {
    const k = `${id}|${talle}`;
    setSeleccion((prev) => {
      const n = Math.max(0, Math.min(MAX_POR_TALLE, (prev[k] ?? 0) + delta));
      const next = { ...prev };
      if (n === 0) delete next[k]; else next[k] = n;
      return next;
    });
  }

  function editarPers(clave, campo, valor) {
    setPers((prev) => ({ ...prev, [clave]: { ...(prev[clave] ?? {}), [campo]: valor } }));
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
        body: JSON.stringify({
          tipo: "encargo",
          items: lineas.map(({ id, talle, unidades }) => ({ id, talle, personalizaciones: unidades })),
          comprador: form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo registrar el pedido.");
      setPedido(data);
      setPaso("listo");
      setSeleccion({});
      setPers({});
      armarFotos(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // Fotos como las del proveedor: una por camiseta personalizada (talle,
  // nombre, #número) y una por modelo/talle para las que van sin personalizar.
  async function armarFotos(items) {
    setFotos("armando");
    const files = [];
    const agregar = async (imagen, lineasTexto) => files.push(await armarImagenCamiseta({
      imagen, lineas: lineasTexto, nombreArchivo: `encargo-mayorista-${String(files.length + 1).padStart(2, "0")}.jpg`,
    }));
    for (const it of items) {
      const unidades = it.personalizaciones ?? Array(it.cantidad).fill(null);
      for (const p of unidades.filter(Boolean)) {
        const texto = [String(it.talle)];
        if (p.nombre) texto.push(p.nombre.toUpperCase());
        if (p.numero) texto.push(`#${p.numero}`);
        await agregar(it.imagen, texto);
      }
      const sinPers = unidades.filter((p) => !p).length;
      if (sinPers > 0) await agregar(it.imagen, [String(it.talle), `x${sinPers}`]);
    }
    setFotos(files);
  }

  function mensajeWhatsApp(p) {
    const detalle = p.items.map((i) => {
      const conPers = (i.personalizaciones ?? []).filter(Boolean);
      const sinPers = i.cantidad - conPers.length;
      const extra = conPers.length
        ? `\n   ↳ ${conPers.map((x) => textoPersonalizacion(x).toUpperCase()).join(" · ")}${sinPers ? ` · ${sinPers} sin personalizar` : ""}`
        : "";
      return `• ${i.nombre.trim()} — Talle ${i.talle} x${i.cantidad}${extra}`;
    }).join("\n");
    return (
      `Hola! Quiero hacer un pedido *MAYORISTA A MEDIDA* (encargo) 🏭\n\n` +
      `*Pedido #${p.id.slice(0, 8)}* · ${p.escala}\n${detalle}\n\n` +
      `${p.cantidad} camisetas × USD ${p.precioUSD} = ${formatoUSD(p.cantidad * p.precioUSD)}\n` +
      (p.extras ? `Personalización: ${p.extras} × USD ${PRECIO_PERSONALIZACION_USD} = ${formatoUSD(p.extras * PRECIO_PERSONALIZACION_USD)}\n` : "") +
      `*Total: ${formatoUSD(p.totalUSD)}*\n\n` +
      `*Seña 60%: ${formatoUSD(p.senaUSD)} → ${pesos(p.senaARS)}* (dólar blue ${pesos(p.dolar)})\n` +
      `Saldo a la entrega: ${formatoUSD(p.saldoUSD)}\n\n` +
      pieMensaje(form)
    );
  }

  return (
    <>
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <TablaEscalas escalas={ESCALAS_ENCARGO} activa={escala}
          nota={`Personalización: +USD ${PRECIO_PERSONALIZACION_USD} por nombre y +USD ${PRECIO_PERSONALIZACION_USD} por número.`} />
        <DolarBlue dolar={dolar} usdSugerido={senaUSD} />
      </div>
      <Condiciones tipo="encargo" />

      <h2 className="text-xl font-bold text-gray-900 mb-1">Elegí del catálogo</h2>
      <p className="text-sm text-gray-500 mb-4">Sumá unidades por talle. La personalización la cargás al revisar el pedido.</p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {[["adultos", "Adultos"], ["kids", "Niños"]].map(([id, label]) => (
          <button key={id} onClick={() => { setSeccion(id); setVisible(24); }}
            className={`px-4 py-2 rounded-full text-sm font-semibold border ${seccion === id ? "bg-orange-500 text-black border-orange-500" : "bg-white text-gray-700 border-gray-300"}`}>
            {label}
          </button>
        ))}
        <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setVisible(24); }} placeholder="Buscar modelo..."
          className="flex-1 min-w-[160px] bg-white border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500" />
      </div>

      {cargando ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-72 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {filtrados.slice(0, visible).map((p) => {
              const talles = ordenarTalles(p.talle ?? []);
              const elegidas = talles.reduce((s, t) => s + (seleccion[`${p.id}|${t}`] ?? 0), 0);
              return (
                <article key={p.id} className={`bg-white rounded-xl border overflow-hidden flex flex-col ${elegidas ? "border-orange-500 ring-1 ring-orange-500" : "border-gray-200"}`}>
                  <div className="h-36 sm:h-44 relative bg-[#f5f5f0]">
                    <Image src={p.imagen} alt={p.nombre} fill unoptimized className="object-contain mix-blend-multiply" sizes="(max-width: 1024px) 50vw, 25vw" />
                    {elegidas > 0 && <span className="absolute top-2 right-2 bg-orange-500 text-black text-xs font-bold rounded-full px-2 py-0.5">{elegidas}</span>}
                  </div>
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{p.nombre}</h3>
                    <div className="flex flex-col gap-1.5 mt-auto">
                      {talles.map((t) => (
                        <div key={t} className="flex items-center gap-2">
                          <span className="flex-1 text-sm font-bold text-gray-800">{t}</span>
                          <Stepper n={seleccion[`${p.id}|${t}`] ?? 0} max={MAX_POR_TALLE} talle={t}
                            onMenos={() => cambiar(p.id, t, -1)} onMas={() => cambiar(p.id, t, 1)} />
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {filtrados.length > visible && (
            <div className="flex justify-center mt-6">
              <button onClick={() => setVisible((v) => v + 24)} className="bg-white border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-full hover:bg-orange-500 hover:text-black hover:border-orange-500">
                Cargar más ({filtrados.length - visible} restantes)
              </button>
            </div>
          )}
          {filtrados.length === 0 && <p className="text-center text-gray-500 py-16">No hay modelos que coincidan.</p>}
        </>
      )}

      <BarraResumen boton="Revisar pedido" deshabilitado={faltan > 0} onClick={() => { setError(null); setPaso("revisar"); }}>
        <p className="text-sm text-gray-700 truncate">
          <strong>{cantidad}</strong> camiseta{cantidad !== 1 ? "s" : ""}
          {cantidad > 0 && <> · {escala ? `${escala.nombre} · ` : ""}USD {precioRef} c/u{extras > 0 && ` + ${extras} pers.`}</>}
        </p>
        <p className="text-lg font-extrabold text-gray-900 leading-tight">
          {formatoUSD(totalUSD)}
          {cantidad > 0 && <span className="text-sm font-semibold text-gray-500"> · Seña {formatoUSD(senaUSD)}{venta ? ` ≈ ${pesos(senaUSD * venta)}` : ""}</span>}
        </p>
        <p className="text-xs text-orange-600 font-medium truncate">
          {faltan > 0 ? `Te faltan ${faltan} para el mínimo de ${MINIMO_MAYORISTA}`
            : proxima ? `Sumá ${proxima.faltan} más y pasás a ${proxima.nombre}: USD ${proxima.precio} c/u` : "¡Tenés el mejor precio!"}
        </p>
      </BarraResumen>

      {paso === "revisar" && (
        <Modal titulo="Tu pedido a medida" onCerrar={() => setPaso(null)}>
          <form onSubmit={confirmarPedido} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <p className="text-xs text-gray-500">Personalización opcional por camiseta: +USD {PRECIO_PERSONALIZACION_USD} por nombre y +USD {PRECIO_PERSONALIZACION_USD} por número.</p>
              {lineas.map((l) => (
                <div key={l.k} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-900">{l.producto.nombre} · T.{l.talle} <span className="text-gray-500 font-normal">x{l.cantidad}</span></p>
                  <div className="mt-2 flex flex-col gap-2">
                    {l.unidades.map((u, i) => {
                      const clave = `${l.k}#${i}`;
                      const v = pers[clave] ?? {};
                      return (
                        <div key={clave} className="grid grid-cols-[auto_1fr_4.5rem] items-center gap-2">
                          <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                          <input value={v.nombre ?? ""} maxLength={20} placeholder="Nombre (opcional)"
                            onChange={(e) => editarPers(clave, "nombre", e.target.value)} className={`${inputClass} !py-1.5 !px-3 text-sm`} />
                          <input value={v.numero ?? ""} maxLength={3} inputMode="numeric" placeholder="N°"
                            onChange={(e) => editarPers(clave, "numero", e.target.value.replace(/\D/g, ""))} className={`${inputClass} !py-1.5 !px-3 text-sm text-center`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <ul className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
              <li className="flex justify-between"><span>{cantidad} camisetas × USD {precioRef}{escala ? ` (${escala.nombre})` : ""}</span><span>{formatoUSD(cantidad * precioRef)}</span></li>
              {extras > 0 && <li className="flex justify-between"><span>Personalización: {extras} × USD {PRECIO_PERSONALIZACION_USD}</span><span>{formatoUSD(extras * PRECIO_PERSONALIZACION_USD)}</span></li>}
              <li className="flex justify-between border-t border-gray-200 pt-2 mt-1 font-bold text-gray-900"><span>Total</span><span>{formatoUSD(totalUSD)}</span></li>
              <li className="flex justify-between font-bold text-green-700">
                <span>Seña {SENA_ENCARGO * 100}% para confirmar</span>
                <span>{formatoUSD(senaUSD)}{venta ? ` ≈ ${pesos(senaUSD * venta)}` : ""}</span>
              </li>
              <li className="flex justify-between text-gray-500"><span>Saldo a la entrega</span><span>{formatoUSD(saldoUSD)}</span></li>
            </ul>

            <DatosComprador form={form} setForm={setForm} tipo="encargo" />
            {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={enviando} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3.5 rounded-xl hover:bg-green-500 disabled:opacity-50">
              {enviando ? <FaSpinner className="animate-spin" /> : <FaWhatsapp className="text-lg" />}
              {enviando ? "Registrando..." : "Confirmar pedido"}
            </button>
            <p className="text-xs text-gray-500 text-center">Los pesos se calculan con el dólar blue del día. Coordinamos la seña y el envío por WhatsApp.</p>
          </form>
        </Modal>
      )}

      {paso === "listo" && pedido && (
        <PedidoListo
          titulo={`¡Pedido #${pedido.id.slice(0, 8)} registrado!`}
          subtitulo={`${pedido.cantidad} camisetas · Total ${formatoUSD(pedido.totalUSD)} · Seña ${formatoUSD(pedido.senaUSD)} (${pesos(pedido.senaARS)})`}
          mensaje={mensajeWhatsApp(pedido)}
          fotos={fotos}
          onCerrar={() => { setPaso(null); setPedido(null); setFotos(null); }}
        />
      )}
    </>
  );
}
