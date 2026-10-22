"use client";

import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [hidratado, setHidratado] = useState(false);

  // Cargar desde localStorage al montar
  useEffect(() => {
    try {
      const stored = localStorage.getItem("zeus_cart");
      if (stored) setItems(JSON.parse(stored));
    } catch {}
    setHidratado(true);
  }, []);

  // Guardar en localStorage cada vez que cambia el carrito
  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem("zeus_cart", JSON.stringify(items));
    } catch {}
  }, [items, hidratado]);

  function agregarAlCarrito({ id, nombre, talle, precio, cantidad = 1, imagen = null, stock = Infinity, tabla = null, descuentoTransferencia = 0, seccion = "camiseta" }) {
    setItems((prev) => {
      const existe = prev.find((i) => i.id === id && i.talle === talle);
      if (existe) {
        const nuevaCantidad = Math.min(existe.cantidad + cantidad, stock);
        if (nuevaCantidad === existe.cantidad) return prev;
        return prev.map((i) =>
          i.id === id && i.talle === talle ? { ...i, cantidad: nuevaCantidad, stock, descuentoTransferencia, seccion } : i
        );
      }
      return [...prev, { id, nombre, talle, precio, cantidad: Math.min(cantidad, stock), imagen, stock, tabla, descuentoTransferencia, seccion }];
    });
  }

  function quitarDelCarrito(id, talle) {
    setItems((prev) => prev.filter((i) => !(i.id === id && i.talle === talle)));
  }

  function vaciarCarrito() {
    setItems([]);
    try { localStorage.removeItem("zeus_cart"); } catch {}
  }

  function cantidadEnCarrito(id, talle) {
    return items.find((i) => i.id === id && i.talle === talle)?.cantidad ?? 0;
  }

  const total         = items.reduce((acc, i) => acc + i.precio * i.cantidad, 0);
  const cantidadTotal = items.reduce((acc, i) => acc + i.cantidad, 0);

  return (
    <CartContext.Provider value={{ items, hidratado, agregarAlCarrito, quitarDelCarrito, vaciarCarrito, total, cantidadTotal, cantidadEnCarrito }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
