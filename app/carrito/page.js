"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { FaWhatsapp, FaTrash, FaTimes, FaArrowRight, FaSpinner } from "react-icons/fa";
import EnvioInfo from "@/components/EnvioInfo";

function formatearPrecio(precio) {
  return "$" + precio.toLocaleString("es-AR");
}

export default function CarritoPage() {
  const { items, hidratado, agregarAlCarrito, cantidadEnCarrito, quitarDelCarrito, vaciarCarrito, total } = useCart();

  // Botón "Terminar mi compra" del mail de recordatorio (lib/recordatorioCarrito.js):
  // /carrito?recuperar=<id> vuelve a cargar esos productos con el precio de hoy.
  // Espera a que el carrito se lea del navegador para no pisarlo.
  const [recuperando, setRecuperando] = useState(false);
  useEffect(() => {
    if (!hidratado) return;
    const id = new URLSearchParams(window.location.search).get("recuperar");
    if (!id) return;
    setRecuperando(true);
    fetch(`/api/carritos?id=${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((d) => {
        for (const i of d.items ?? []) {
          if (!cantidadEnCarrito(i.id, i.talle)) agregarAlCarrito({ ...i, stock: i.stock ?? undefined });
        }
        try { localStorage.setItem("zeus_carrito_id", id); } catch {}
      })
      .catch(() => {})
      .finally(() => setRecuperando(false));
    // Solo una vez, al terminar de leer el carrito guardado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidratado]);

  if (items.length === 0 && recuperando) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-16 flex justify-center">
        <FaSpinner className="text-orange-500 text-3xl animate-spin" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-2xl font-bold text-gray-900 mb-2">Tu carrito está vacío</p>
        <p className="text-gray-500 mb-8">Todavía no agregaste ningún producto.</p>
        <Link
          href="/catalogo"
          className="inline-block bg-orange-500 text-black font-semibold px-8 py-4 rounded-xl hover:bg-orange-400 transition-colors text-lg"
        >
          Ver catálogo
        </Link>
      </main>
    );
  }

  const lineasProductos = items
    .map((i) => `${i.nombre} - ${i.talle} x${i.cantidad} - ${formatearPrecio(i.precio * i.cantidad)}`)
    .join(", ");
  const whatsappUrl = `https://wa.me/5492216220145?text=${encodeURIComponent(
    `Hola! Quiero consultar por estos productos: ${lineasProductos} Total: ${formatearPrecio(total)}`
  )}`;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 pb-40 md:pb-8">
      <h1 className="text-2xl md:text-3xl font-extrabold mb-6 md:mb-8 text-gray-900">Tu carrito</h1>

      {/* Lista de items */}
      <section className="flex flex-col gap-3 mb-8">
        {items.map((item) => (
          <article
            key={`${item.id}-${item.talle}`}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4"
          >
            {/* Imagen miniatura */}
            {item.imagen && (
              <div className="shrink-0 w-16 h-16 rounded-lg bg-white overflow-hidden">
                <img
                  src={item.imagen}
                  alt={item.nombre}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Detalles */}
            <div className="flex flex-col gap-1 flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{item.nombre}</p>
              <p className="text-sm text-gray-500">
                Talle {item.talle} · Cantidad: {item.cantidad}
              </p>
              <p className="text-orange-500 font-bold">
                {formatearPrecio(item.precio * item.cantidad)}
              </p>
            </div>

            <button
              onClick={() => quitarDelCarrito(item.id, item.talle)}
              className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:text-red-600 hover:bg-red-100 transition-colors"
              aria-label={`Quitar ${item.nombre}`}
            >
              <FaTimes />
            </button>
          </article>
        ))}
      </section>

      {/* Total y acciones — visible solo en desktop */}
      <div className="hidden md:block">
        <div className="flex justify-between items-center border-t border-gray-200 pt-4 mb-2">
          <span className="text-lg font-bold text-gray-900">Total</span>
          <span className="text-2xl font-extrabold text-orange-500">{formatearPrecio(total)}</span>
        </div>
        <EnvioInfo className="mb-6 text-sm" />

        <div className="flex flex-col gap-3 max-w-sm">
          <Link
            href="/checkout"
            className="flex items-center justify-center gap-2 bg-orange-500 text-black font-semibold py-3 rounded-xl hover:bg-orange-400 transition-colors"
          >
            <FaArrowRight />
            Proceder al pago
          </Link>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-100 hover:text-black transition-colors"
          >
            <FaWhatsapp className="text-xl" />
            Consultar por WhatsApp
          </a>

          <button
            onClick={vaciarCarrito}
            className="flex items-center justify-center gap-2 w-full border border-gray-300 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-100 hover:text-black transition-colors"
          >
            <FaTrash />
            Vaciar carrito
          </button>
        </div>
      </div>

      {/* Sticky footer — solo en mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl p-4 z-40">
        <div className="flex justify-between items-center mb-1">
          <span className="font-semibold text-gray-900">Total</span>
          <span className="text-xl font-extrabold text-orange-500">{formatearPrecio(total)}</span>
        </div>
        <EnvioInfo className="mb-3 text-xs" />
        <div className="flex gap-3">
          <button
            onClick={vaciarCarrito}
            className="w-11 h-11 shrink-0 flex items-center justify-center border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 hover:text-black transition-colors"
            aria-label="Vaciar carrito"
          >
            <FaTrash />
          </button>
          <Link
            href="/checkout"
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-black font-semibold py-3 rounded-xl hover:bg-orange-400 transition-colors active:scale-95"
          >
            <FaArrowRight />
            Proceder al pago
          </Link>
        </div>
      </div>
    </main>
  );
}
