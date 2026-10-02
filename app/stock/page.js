"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import FadeIn from "@/components/FadeIn";
import { FaChevronDown, FaChevronUp, FaFilter } from "react-icons/fa";
import { MAX_CUOTAS } from "@/lib/cuotas";
import SkeletonCard from "@/components/SkeletonCard";
import { useVolverAlListado } from "@/lib/useVolverAlListado";

function formatearPrecio(precio) {
  return "$" + precio.toLocaleString("es-AR");
}

function stockTotal(p) {
  const tallesActivos = p.talle ?? [];
  const porTalle = p.stock_por_talle ?? {};

  // Si hay al menos un talle activo con stock por talle definido,
  // consideramos que el producto se maneja por talle. Sumamos solo
  // los talles activos (ignorando datos huerfanos de talles eliminados).
  const hayPerTalle = tallesActivos.some((t) => porTalle[t] !== undefined);
  if (hayPerTalle && tallesActivos.length > 0) {
    return tallesActivos.reduce((s, t) => s + (Number(porTalle[t]) || 0), 0);
  }

  // Caso contrario: se maneja con stock global
  return Number(p.stock) || 0;
}

function tieneStock(p) {
  return stockTotal(p) > 0;
}

const filtrosTipo  = ["Todos", "Naciones", "Clubes"];
const filtrosTalle = ["Todos", "S", "M", "L", "XL", "2XL", "3XL"];
const tipoValor    = { Naciones: "nacion", Clubes: "club" };
const badgeTipo    = { nacion: "bg-zinc-700 text-white", club: "bg-orange-500/20 text-orange-400" };

function BotonFiltro({ label, activo, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-colors min-w-[60px] ${
        activo
          ? "bg-orange-500 text-black border-orange-500"
          : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-white hover:text-black hover:border-gray-400"
      }`}
    >
      {label}
    </button>
  );
}

export default function StockPage() {
  const [productos, setProductos] = useState([]);
  const [cargando,  setCargando]  = useState(true);
  const [tipo,  setTipo]  = useState("Todos");
  const [talle, setTalle] = useState("Todos");
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [visible, setVisible] = useState(12);

  // Al volver de un producto, retomar el mismo scroll, filtros y cantidad cargada
  const guardarPosicion = useVolverAlListado("stock", {
    estado: { tipo, talle, busqueda, visible },
    restaurar: (e) => {
      setTipo(e.tipo ?? "Todos");
      setTalle(e.talle ?? "Todos");
      setBusqueda(e.busqueda ?? "");
      setVisible(e.visible ?? 12);
    },
    listo: !cargando,
  });

  useEffect(() => {
    supabase
      .from("productos_stock")
      .select("*")
      .order("creado_at", { ascending: false })
      .then(({ data }) => {
        // Excluir bucales (tienen su propia sección)
        const camisetas = (data ?? []).filter((p) => (p.seccion ?? "camiseta") !== "bucal");
        setProductos(camisetas);
        setCargando(false);
      });
  }, []);

  // Solo productos con stock disponible (>0 en stock global o en algún talle).
  const productosConStock = productos.filter(tieneStock);

  const productosFiltrados = productosConStock.filter((p) => {
    const matchTipo  = tipo  === "Todos" || p.tipo  === tipoValor[tipo];
    const matchTalle = talle === "Todos" || (p.talle ?? []).includes(talle);
    const matchBusqueda = busqueda === "" || p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchTipo && matchTalle && matchBusqueda;
  });

  const sinStockGeneral = !cargando && productosConStock.length === 0;

  const hayFiltrosActivos  = tipo !== "Todos" || talle !== "Todos" || busqueda !== "";
  const cantFiltrosActivos = (tipo !== "Todos" ? 1 : 0) + (talle !== "Todos" ? 1 : 0) + (busqueda !== "" ? 1 : 0);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900">Stock disponible</h1>
        <span className="bg-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">En stock</span>
      </div>
      <p className="text-gray-500 text-sm mb-6">Productos disponibles para envío inmediato.</p>

      {/* Filtros */}
      <section className="bg-gray-50 border border-gray-200 rounded-xl mb-8 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 md:hidden"
          onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
        >
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <FaFilter className="text-orange-500" />
            Filtros
            {hayFiltrosActivos && (
              <span className="bg-orange-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cantFiltrosActivos}
              </span>
            )}
          </span>
          {filtrosAbiertos ? <FaChevronUp className="text-gray-500" /> : <FaChevronDown className="text-gray-500" />}
        </button>

        <div className={`flex flex-col gap-4 transition-all duration-300 overflow-hidden md:px-5 md:pb-5 md:pt-5 md:max-h-none md:overflow-visible ${filtrosAbiertos ? "max-h-[500px] px-5 pb-5" : "max-h-0"}`}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-500 w-20">Buscar</span>
            <input
              type="text"
              placeholder="Nombre del producto..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setVisible(12); }}
              className="flex-1 bg-white border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
            />
            {busqueda && (
              <button onClick={() => { setBusqueda(""); setVisible(12); }} className="text-sm text-gray-400 hover:text-red-500 transition-colors">✕</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-500 w-20">Tipo</span>
            {filtrosTipo.map((f) => <BotonFiltro key={f} label={f} activo={tipo === f} onClick={() => { setTipo(f); setVisible(12); }} />)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-500 w-20">Talle</span>
            {filtrosTalle.map((f) => <BotonFiltro key={f} label={f} activo={talle === f} onClick={() => { setTalle(f); setVisible(12); }} />)}
          </div>
          {hayFiltrosActivos && (
            <button onClick={() => { setTipo("Todos"); setTalle("Todos"); setBusqueda(""); setVisible(12); }} className="self-start text-sm text-gray-400 underline hover:text-red-600 transition-colors">
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {cargando ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : sinStockGeneral ? (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl py-16 px-6 text-center flex flex-col items-center gap-5">
          <div className="text-orange-500 text-5xl">📦</div>
          <p className="text-xl font-bold text-gray-900">No tenemos stock por el momento</p>
          <p className="text-gray-500 max-w-md">Únicamente pedidos por encargo. Mirá nuestro catálogo y encargá la tuya.</p>
          <Link
            href="/catalogo"
            className="inline-block bg-orange-500 text-black font-semibold px-8 py-4 rounded-xl hover:bg-orange-400 transition-colors mt-2"
          >
            Ver catálogo
          </Link>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">
            {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""} encontrado{productosFiltrados.length !== 1 ? "s" : ""}
          </p>

          <section className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {productosFiltrados.slice(0, visible).map((producto, i) => (
              <FadeIn key={producto.id} delay={i * 60}>
                <Link href={`/stock/${producto.id}`} onClick={guardarPosicion} className="block h-full">
                  <article className="bg-[#f5f5f0] rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col transition-transform duration-300 hover:-translate-y-2 hover:shadow-lg h-full cursor-pointer">
                    <div className="relative h-40 sm:h-52 bg-[#f5f5f0] overflow-hidden">
                      <Image
                        src={producto.imagen}
                        alt={producto.nombre}
                        fill
                        unoptimized
                        className="object-contain mix-blend-multiply"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                        loading="lazy"
                      />
                      <span className="absolute top-2 right-2 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        Stock: {stockTotal(producto)}
                      </span>
                    </div>
                    <div className="p-3 md:p-4 flex flex-col flex-1 gap-2">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full self-start ${badgeTipo[producto.tipo]}`}>
                        {producto.tipo === "nacion" ? "Nación" : "Club"}
                      </span>
                      <h2 className="font-semibold text-gray-900 text-sm md:text-base leading-tight">{producto.nombre}</h2>
                      <div className="flex gap-1 flex-wrap">
                        {(producto.talle ?? []).map((t) => (
                          <span key={t} className="text-xs border border-gray-300 rounded px-1.5 py-0.5 text-gray-600">{t}</span>
                        ))}
                      </div>
                      <div className="mt-auto flex flex-col gap-0.5">
                        <p className="text-orange-500 font-bold text-sm md:text-base">{formatearPrecio(producto.precio)}</p>
                        {producto.descuento_transferencia > 0 && (
                          <p className="text-green-700 text-xs font-semibold">
                            Transf. {formatearPrecio(Math.round(producto.precio * (1 - producto.descuento_transferencia / 100)))}
                            <span className="text-green-600 ml-1">−{producto.descuento_transferencia}%</span>
                          </p>
                        )}
                        <p className="text-gray-500 text-xs">Hasta {MAX_CUOTAS} cuotas con tarjeta</p>
                      </div>
                      <div className="block text-center bg-orange-500 text-black text-sm font-semibold py-2.5 rounded-lg hover:bg-orange-400 transition-colors mt-1">
                        Ver detalle
                      </div>
                    </div>
                  </article>
                </Link>
              </FadeIn>
            ))}
          </section>

          {productosFiltrados.length > visible && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setVisible(v => v + 12)}
                className="bg-white border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-full hover:bg-orange-500 hover:text-black hover:border-orange-500 transition-colors"
              >
                Cargar más ({productosFiltrados.length - visible} restantes)
              </button>
            </div>
          )}

          {productosFiltrados.length === 0 && (
            <p className="text-center text-gray-400 py-16">No hay productos que coincidan con los filtros.</p>
          )}
        </>
      )}
    </main>
  );
}
