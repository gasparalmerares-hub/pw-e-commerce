"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import { FaChevronRight, FaSpinner, FaWhatsapp, FaShareSquare } from "react-icons/fa";
import { trackViewContent, trackAddToCart } from "@/lib/fbpixel";
import CuotasMP from "@/components/CuotasMP";

const WHATSAPP_ADMIN = "5492216220145";

function formatearPrecio(precio) {
  return "$" + precio.toLocaleString("es-AR");
}

const badgeTipo = { nacion: "bg-zinc-700 text-white", club: "bg-orange-500/20 text-orange-400" };

function ShareButton({ nombre }) {
  const [copiado, setCopiado] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: nombre, text: `Mirá esta camiseta: ${nombre}`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      title={copiado ? "¡Enlace copiado!" : "Compartir"}
      className="p-2 text-gray-400 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-100"
    >
      <FaShareSquare className="text-xl" />
    </button>
  );
}

export default function StockDetalleClient({ params }) {
  const [producto, setProducto] = useState(null);
  const [cargando, setCargando] = useState(true);
  const { agregarAlCarrito, cantidadEnCarrito } = useCart();

  const [imagenActiva,      setImagenActiva]      = useState(0);
  const [talleSeleccionado, setTalleSeleccionado] = useState(null);
  const [cantidad,          setCantidad]          = useState(1);
  const [estado,            setEstado]            = useState("idle");

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    supabase
      .from("productos_stock")
      .select("*")
      .eq("id", params.id)
      .single()
      .then(({ data }) => {
        setProducto(data);
        setCargando(false);
        if (data) trackViewContent(data);
      });
  }, [params.id]);

  useEffect(() => {
    if (estado === "success") {
      const t = setTimeout(() => setEstado("idle"), 1500);
      return () => clearTimeout(t);
    }
  }, [estado]);

  if (cargando) {
    return (
      <main className="flex items-center justify-center py-20">
        <FaSpinner className="text-orange-500 text-3xl animate-spin" />
      </main>
    );
  }

  if (!producto) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-8 text-center">
        <p className="text-xl font-semibold text-gray-400">Producto no encontrado.</p>
        <Link href="/stock" className="mt-6 inline-block text-orange-500 underline">Volver al stock</Link>
      </main>
    );
  }

  const imagenes = [producto.imagen, producto.imagen_espalda, ...(producto.imagenes_extra ?? [])].filter(Boolean);

  const esColor = producto.tipo_variante === "color" || producto.seccion === "bucal";

  const stockTalle = talleSeleccionado && producto.stock_por_talle?.[talleSeleccionado] !== undefined
    ? producto.stock_por_talle[talleSeleccionado]
    : producto.stock ?? 0;

  const yaEnCarrito = talleSeleccionado ? cantidadEnCarrito(producto.id, talleSeleccionado) : 0;
  const disponible  = Math.max(0, stockTalle - yaEnCarrito);
  // Todas las unidades de este talle ya están en el carrito: no es "sin stock",
  // el comprador tiene que ir a pagar (antes se mostraba "Sin stock" y parecía
  // que la compra había fallado).
  const todoEnCarrito = yaEnCarrito > 0 && disponible === 0;

  function handleAgregar() {
    if (!talleSeleccionado) { setEstado("warning"); return; }
    if (disponible === 0) return;
    agregarAlCarrito({
      id: producto.id, nombre: producto.nombre, talle: talleSeleccionado,
      precio: producto.precio, cantidad, imagen: producto.imagen,
      stock: stockTalle, tabla: "productos_stock",
      descuentoTransferencia: producto.descuento_transferencia ?? 0,
      seccion: esColor ? "bucal" : "camiseta",
    });
    trackAddToCart({
      id: producto.id, nombre: producto.nombre, precio: producto.precio,
      cantidad, talle: talleSeleccionado,
    });
    setCantidad(1);
    setEstado("success");
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-4">
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-3">
        <Link href="/" className="hover:text-orange-500 transition-colors">Inicio</Link>
        <FaChevronRight className="text-xs" />
        <Link href={esColor ? "/bucales" : "/stock"} className="hover:text-orange-500 transition-colors">{esColor ? "Bucales" : "Stock"}</Link>
        <FaChevronRight className="text-xs" />
        <span className="text-gray-900 font-medium truncate max-w-[180px]">{producto.nombre}</span>
      </nav>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Galería */}
        <div className="w-full md:w-2/5 flex flex-col gap-2">
          <div className="h-64 md:h-80 w-full rounded-xl overflow-hidden bg-[#f5f5f0] relative">
            <Image
              key={imagenActiva}
              src={imagenes[imagenActiva]}
              alt={producto.nombre}
              fill
              priority
              unoptimized
              className="object-contain mix-blend-multiply animate-[fadeIn_0.3s_ease-out]"
              sizes="(max-width: 768px) 100vw, 40vw"
            />
          </div>
          {imagenes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {imagenes.map((src, i) => (
                <button key={i} onClick={() => setImagenActiva(i)} className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors bg-[#f5f5f0] relative ${imagenActiva === i ? "border-orange-500" : "border-gray-200 hover:border-gray-400"}`}>
                  <Image src={src} alt={`Vista ${i + 1}`} fill unoptimized className="object-contain mix-blend-multiply" sizes="64px" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="w-full md:w-3/5 flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap items-center">
            {esColor ? (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-500 text-black">Protector bucal</span>
            ) : (
              <>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${badgeTipo[producto.tipo]}`}>
                  {producto.tipo === "nacion" ? "Nación" : "Club"}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-orange-500 text-black capitalize">{producto.categoria}</span>
              </>
            )}
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-600 text-white">En stock</span>
            <div className="ml-auto">
              <ShareButton nombre={producto.nombre} />
            </div>
          </div>

          <h1 className="text-xl md:text-2xl font-extrabold text-gray-900 leading-tight">{producto.nombre}</h1>

          {producto.descuento_transferencia > 0 ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <p className="text-orange-500 text-2xl font-bold">{formatearPrecio(producto.precio)}</p>
                <span className="text-xs text-gray-400">Tarjeta de débito o crédito</span>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-green-700 text-2xl font-bold">
                  {formatearPrecio(Math.round(producto.precio * (1 - producto.descuento_transferencia / 100)))}
                </p>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  Transferencia −{producto.descuento_transferencia}%
                </span>
              </div>
            </div>
          ) : (
            <p className="text-orange-500 text-2xl font-bold">{formatearPrecio(producto.precio)}</p>
          )}

          <CuotasMP precio={producto.precio} />

          <p className="text-gray-600 text-sm leading-relaxed">{producto.descripcion}</p>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">{esColor ? "Seleccioná tu color:" : "Seleccioná tu talle:"}</p>
            <div className="flex gap-2 flex-wrap">
              {(producto.talle ?? []).map((t) => {
                const stockT  = producto.stock_por_talle?.[t] !== undefined ? producto.stock_por_talle[t] : null;
                const sinStock = stockT !== null && stockT === 0;
                return (
                  <button key={t} onClick={() => { if (!sinStock) { setTalleSeleccionado(t); setCantidad(1); setEstado("idle"); } }}
                    className={`rounded-xl border-2 text-sm font-bold transition-colors active:scale-95 ${esColor ? "px-4 h-12" : "w-12 h-12"} ${
                      sinStock
                        ? "opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200"
                        : talleSeleccionado === t
                          ? "bg-orange-500 text-black border-orange-500"
                          : "bg-gray-100 text-gray-700 border-gray-300 hover:border-gray-500 hover:text-gray-900"
                    }`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">Cantidad:</p>
            <div className="flex items-center w-fit">
              <button onClick={() => setCantidad(c => Math.max(1, c - 1))} disabled={cantidad === 1} className="w-10 h-10 rounded-l-xl bg-orange-500 text-black font-bold text-lg hover:bg-orange-400 disabled:opacity-40 transition-colors">−</button>
              <span className="w-12 h-10 flex items-center justify-center bg-gray-100 border-y border-gray-300 text-gray-900 font-bold text-sm">{cantidad}</span>
              <button onClick={() => setCantidad(c => Math.min(disponible, c + 1))} disabled={cantidad >= disponible} className="w-10 h-10 rounded-r-xl bg-orange-500 text-black font-bold text-lg hover:bg-orange-400 disabled:opacity-40 transition-colors">+</button>
            </div>
            {yaEnCarrito > 0 && <p className="text-xs text-gray-400 mt-1">Ya tenés {yaEnCarrito} en el carrito</p>}
          </div>

          {estado === "warning" && <p className="text-red-600 text-sm">Seleccioná un {esColor ? "color" : "talle"} primero.</p>}

          {todoEnCarrito ? (
            <Link href="/carrito" className="w-full flex items-center justify-center font-semibold py-3 rounded-xl text-base bg-green-600 text-white hover:bg-green-500 active:scale-95 transition-all duration-200">
              ✓ Ya está en tu carrito · Finalizar compra
            </Link>
          ) : (
            <button onClick={handleAgregar} disabled={disponible === 0} className={`w-full font-semibold py-3 rounded-xl text-base active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${estado === "success" ? "bg-green-600 text-white scale-95" : "bg-orange-500 text-black hover:bg-orange-400"}`}>
              {disponible === 0 ? `Sin stock para este ${esColor ? "color" : "talle"}` : estado === "success" ? "✓ Agregado al carrito" : "Agregar al carrito"}
            </button>
          )}

          <a
            href={`https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(`Hola! Me interesa ${esColor ? "el protector bucal" : "la camiseta"} *${producto.nombre}*. ¿Podés darme más info?`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 border border-green-600 text-green-700 font-semibold py-3 rounded-xl text-base hover:bg-green-50 transition-colors"
          >
            <FaWhatsapp className="text-lg" />
            Preguntar por WhatsApp
          </a>

          {!esColor && (
            <Link href="/guia-de-talles" className="text-sm text-gray-400 hover:text-orange-500 transition-colors">Ver guía de talles →</Link>
          )}
        </div>
      </div>
    </main>
  );
}
