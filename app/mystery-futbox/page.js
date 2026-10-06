"use client";

import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";
import { trackAddToCart } from "@/lib/fbpixel";
import FadeIn from "@/components/FadeIn";
import { FaSpinner } from "react-icons/fa";

const talles = ["S", "M", "L", "XL", "2XL", "3XL"];

const FALLBACK = {
  nombre: "Mystery Rugbox",
  precio: 50800,
  precio_original: 69980,
  descuento_label: "27% OFF",
  descripcion: "Una caja sorpresa con una camiseta de rugby a elección del equipo. Indicanos por WhatsApp el parche/estampado que querés.",
  imagen: "/mysteryfutbox.png",
};

function formatearPrecio(precio) {
  return "$" + precio.toLocaleString("es-AR");
}

export default function MysteryFutboxPage() {
  const { agregarAlCarrito } = useCart();
  const [talleSeleccionado, setTalleSeleccionado] = useState(null);
  const [estado, setEstado] = useState("idle");
  const [data,   setData]   = useState(null);

  useEffect(() => {
    supabase
      .from("paginas_especiales")
      .select("*")
      .eq("id", "mystery_futbox")
      .single()
      .then(({ data }) => {
        setData(data ?? FALLBACK);
      });
  }, []);

  useEffect(() => {
    if (estado === "success") {
      const t = setTimeout(() => setEstado("idle"), 1500);
      return () => clearTimeout(t);
    }
  }, [estado]);

  function handleAgregar() {
    if (!talleSeleccionado) { setEstado("warning"); return; }
    agregarAlCarrito({ id: "mystery-futbox", nombre: data.nombre, talle: talleSeleccionado, precio: data.precio, imagen: data.imagen });
    trackAddToCart({ id: "mystery-futbox", nombre: data.nombre, precio: data.precio, cantidad: 1, talle: talleSeleccionado });
    setEstado("success");
  }

  if (!data) return (
    <main className="flex items-center justify-center py-20">
      <FaSpinner className="text-orange-500 text-3xl animate-spin" />
    </main>
  );

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <FadeIn>
        <h1 className="text-3xl font-extrabold mb-6 text-white">{data.nombre}</h1>
      </FadeIn>

      <FadeIn delay={100}>
        <article className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-sm flex flex-col md:flex-row">
          <div className="md:w-1/2 bg-black flex items-center justify-center">
            <img src={data.imagen} alt={data.nombre} className="w-full object-contain max-h-72 md:max-h-full md:h-full" />
          </div>

          <div className="md:w-1/2 p-6 flex flex-col gap-5 justify-center">
            {data.precio_original && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-gray-400 line-through text-lg">{formatearPrecio(data.precio_original)}</span>
                {data.descuento_label && (
                  <span className="bg-orange-500 text-black text-xs font-bold px-2 py-1 rounded-full">{data.descuento_label}</span>
                )}
              </div>
            )}
            <p className="text-orange-500 text-3xl font-extrabold -mt-3">{formatearPrecio(data.precio)}</p>
            <p className="text-gray-300 text-sm">{data.descripcion}</p>

            <div>
              <p className="text-sm font-semibold text-gray-300 mb-2">Seleccioná tu talle:</p>
              <div className="flex gap-2 flex-wrap">
                {talles.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTalleSeleccionado(t); setEstado("idle"); }}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      talleSeleccionado === t
                        ? "bg-orange-500 text-black border-orange-500"
                        : "bg-zinc-800 text-gray-200 border-zinc-600 hover:border-white hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {estado === "warning" && <p className="text-red-400 text-sm">Seleccioná un talle primero.</p>}
            <button
              onClick={handleAgregar}
              className={`w-full text-center font-semibold py-3 rounded-xl transition-all duration-200 ${
                estado === "success" ? "bg-green-600 text-white scale-95" : "bg-orange-500 text-black hover:bg-orange-400"
              }`}
            >
              {estado === "success" ? "✓ Agregado" : "Agregar al carrito"}
            </button>
          </div>
        </article>
      </FadeIn>
    </main>
  );
}
