"use client";

import { useEffect, useRef } from "react";

// Al volver de un producto, el listado se vuelve a montar: recarga los
// productos, muestra solo los primeros y resetea los filtros, así que el
// navegador no puede devolver al comprador a donde estaba. Este hook guarda
// el scroll y el estado del listado al entrar a un producto y lo restaura al
// volver, una vez que los productos ya están en pantalla.
//
//   const guardarPosicion = useVolverAlListado("catalogo", {
//     estado:    { tipo, talle, busqueda, visible },
//     restaurar: (e) => { ...setters },
//     listo:     !cargando,
//   });
//   <Link href={...} onClick={guardarPosicion}>

const VIGENCIA_MS = 30 * 60 * 1000; // pasado este tiempo se arranca de cero

export function useVolverAlListado(clave, { estado, restaurar, listo }) {
  const scrollPendiente = useRef(null);
  const storageKey = `listado:${clave}`;

  // Al montar: recuperar filtros y cantidad visible; el scroll queda pendiente
  useEffect(() => {
    try {
      const guardado = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      sessionStorage.removeItem(storageKey);
      if (!guardado || Date.now() - guardado.ts > VIGENCIA_MS) return;
      restaurar(guardado.estado ?? {});
      scrollPendiente.current = guardado.y;
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando los productos ya están en pantalla, volver al mismo lugar
  useEffect(() => {
    if (!listo || scrollPendiente.current == null) return;
    const y = scrollPendiente.current;
    scrollPendiente.current = null;
    // Directo (los productos ya están en el DOM) y otra vez un instante después,
    // por si el navegador aplica su propia restauración de scroll más tarde.
    // No se usa requestAnimationFrame: no corre si la pestaña no está visible.
    window.scrollTo(0, y);
    const t = setTimeout(() => window.scrollTo(0, y), 150);
    return () => clearTimeout(t);
  }, [listo]);

  return function guardarPosicion() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ y: window.scrollY, estado, ts: Date.now() }));
    } catch {}
  };
}
