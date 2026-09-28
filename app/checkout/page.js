"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { FaChevronRight, FaCreditCard, FaWhatsapp } from "react-icons/fa";
import { trackInitiateCheckout } from "@/lib/fbpixel";
import { PROVINCIAS, precioEnvioPara } from "@/lib/envio";

const WHATSAPP_ADMIN = "5492216220145";

function formatearPrecio(precio) {
  return "$" + precio.toLocaleString("es-AR");
}

function Campo({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-gray-600">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors";

export default function CheckoutPage() {
  const { items, total, vaciarCarrito } = useCart();

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    codigoArea: "",
    celular: "",
    provincia: "",
    localidad: "",
    calle: "",
    numero: "",
    piso: "",
    departamento: "",
    codigoPostal: "",
    observaciones: "",
  });
  const [config,           setConfig]           = useState({});
  const [precioEstampa,    setPrecioEstampa]    = useState(0);
  // Parche por item: map keyed por `${id}-${talle}` → { activo, detalle }
  const [parches,          setParches]          = useState({});
  const [cargando,         setCargando]         = useState(false);
  const [cargandoTransf,   setCargandoTransf]   = useState(false);
  const [error,            setError]            = useState(null);

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setConfig(d);
        setPrecioEstampa(parseInt(d.precio_estampa) || 0);
      })
      .catch(() => {});
  }, []);

  // El envío depende de la provincia elegida (hasta elegirla se muestra "—")
  const precioEnvio = form.provincia ? precioEnvioPara(config, form.provincia) : 0;

  // El parche estampado solo aplica a camisetas por encargo (catálogo y niños,
  // que están en productos_catalogo). No aplica a stock ni a bucales.
  const itemKey      = (it) => `${it.id}-${it.talle}`;
  const elegibles    = items.filter((it) => it.tabla === "productos_catalogo");
  const seleccionados = elegibles.filter((it) => parches[itemKey(it)]?.activo);
  const costoEstampa  = seleccionados.length * precioEstampa;

  // Lista de parches con detalle, lista para enviar al backend / WhatsApp
  const parchesPayload = seleccionados.map((it) => ({
    nombre: it.nombre,
    talle: it.talle,
    detalle: (parches[itemKey(it)]?.detalle ?? "").trim(),
  }));
  const parchesIncompletos = seleccionados.some((it) => !(parches[itemKey(it)]?.detalle ?? "").trim());

  // Disparar InitiateCheckout cuando hay items y el componente está listo.
  useEffect(() => {
    if (items.length === 0) return;
    trackInitiateCheckout({ items, total: total + precioEnvio + costoEstampa });
    // Sin precioEnvio en las dependencias: cambiar de provincia no debe
    // volver a disparar el evento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, costoEstampa]);

  // Cuando el usuario vuelve con "atrás" desde MP, el bfcache restaura la
  // página con cargando=true. El evento pageshow la resetea.
  useEffect(() => {
    function handlePageShow(e) {
      if (e.persisted) { setCargando(false); setCargandoTransf(false); }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  if (items.length === 0) {
    return (
      <main className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-2xl font-bold text-gray-900 mb-2">Tu carrito está vacío</p>
        <p className="text-gray-500 mb-8">Agregá productos desde el stock para continuar.</p>
        <Link
          href="/stock"
          className="inline-block bg-orange-500 text-black font-semibold px-8 py-4 rounded-xl hover:bg-orange-400 transition-colors text-lg"
        >
          Ver stock disponible
        </Link>
      </main>
    );
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function formValido() {
    return (
      form.nombre && form.email && form.codigoArea && form.celular &&
      form.provincia && form.localidad && form.calle && form.numero && form.codigoPostal
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (parchesIncompletos) {
      setError("Escribí qué querés estampar en cada camiseta con parche seleccionado.");
      return;
    }
    setCargando(true);
    setError(null);

    try {
      const res = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, comprador: form, parches: parchesPayload }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al procesar el pago");

      // Guardar resumen para disparar Purchase en /checkout/exito al volver de MP
      try {
        localStorage.setItem("pendingPurchase", JSON.stringify({
          items, total: total + precioEnvio + costoEstampa, ts: Date.now(),
        }));
      } catch {}

      // Abrir en nueva pestaña para evitar que iOS redirija a la app de MP
      // (los Universal Links solo se disparan en navegación de misma pestaña)
      const popup = window.open(data.url, "_blank", "noopener,noreferrer");

      // Si el navegador bloqueó la pop-up (ej: Instagram, Facebook, TikTok
      // in-app browsers, popup blockers), redirigir en la misma pestaña como
      // fallback para que igual pueda pagar.
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        window.location.href = data.url;
      } else {
        setCargando(false);
      }
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  async function handleTransferencia(e) {
    e.preventDefault();
    if (!formValido()) {
      setError("Completá todos los campos obligatorios antes de continuar.");
      return;
    }
    if (parchesIncompletos) {
      setError("Escribí qué querés estampar en cada camiseta con parche seleccionado.");
      return;
    }
    setCargandoTransf(true);
    setError(null);

    try {
      // Calcular precios con descuento por transferencia por item
      const itemsTransf = items.map((i) => {
        const desc = Number(i.descuentoTransferencia) || 0;
        const precioTransf = Math.round(i.precio * (1 - desc / 100));
        return { ...i, precioTransf, descuentoTransferencia: desc };
      });
      const subtotalTransf = itemsTransf.reduce((s, i) => s + i.precioTransf * i.cantidad, 0);
      const totalFinal     = subtotalTransf + precioEnvio + costoEstampa;

      const res = await fetch("/api/pedidos/transferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsTransf, comprador: form, parches: parchesPayload, precioEstampa }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Error al registrar el pedido");

      const resumen = itemsTransf
        .map((i) => `• ${i.nombre} T.${i.talle} x${i.cantidad} = ${formatearPrecio(i.precioTransf * i.cantidad)}${i.descuentoTransferencia > 0 ? ` _(−${i.descuentoTransferencia}% transf.)_` : ""}`)
        .join("\n");
      const parchesTxt = parchesPayload
        .map((p) => `Parche en ${p.nombre} T.${p.talle}: ${p.detalle} (+${formatearPrecio(precioEstampa)})`)
        .join("\n");
      const msg =
        `Hola! Quiero pagar por transferencia.\n\n` +
        `*Pedido #${data.id}*\n${resumen}\n` +
        (parchesPayload.length ? `\n*Parches estampados:*\n${parchesTxt}\n` : "") +
        `\nEnvío: ${formatearPrecio(precioEnvio)}\n` +
        `*Total: ${formatearPrecio(totalFinal)}*\n\n` +
        `Nombre: ${form.nombre}\n` +
        `Dir: ${form.calle} ${form.numero}, ${form.localidad}, ${form.provincia}`;

      // El Purchase de transferencia NO se dispara acá (el pago aún no está
      // confirmado). Se dispara server-side cuando marcás el pedido como
      // "pagado" en el admin (Conversions API), para métricas correctas.
      vaciarCarrito();
      window.location.href = `https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(msg)}`;
    } catch (err) {
      setError(err.message);
      setCargandoTransf(false);
    }
  }

  const totalConEnvio = total + precioEnvio + costoEstampa;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-orange-500 transition-colors">Inicio</Link>
        <FaChevronRight className="text-xs" />
        <Link href="/carrito" className="hover:text-orange-500 transition-colors">Carrito</Link>
        <FaChevronRight className="text-xs" />
        <span className="text-gray-900 font-medium">Checkout</span>
      </nav>

      <h1 className="text-2xl md:text-3xl font-extrabold mb-6 md:mb-8 text-gray-900">Finalizar compra</h1>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6">

          {/* Datos personales */}
          <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-900">Datos personales</h2>

            <Campo label="Nombre y apellido *">
              <input
                type="text" name="nombre" value={form.nombre}
                onChange={handleChange} required placeholder="Juan García"
                className={inputClass}
              />
            </Campo>

            <Campo label="Email *">
              <input
                type="email" name="email" value={form.email}
                onChange={handleChange} required placeholder="juan@email.com"
                className={inputClass}
              />
            </Campo>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Campo label="Cód. de área *">
                <input
                  type="tel" name="codigoArea" value={form.codigoArea}
                  onChange={handleChange} required placeholder="11"
                  className={inputClass}
                />
              </Campo>
              <div className="col-span-2">
                <Campo label="Celular *">
                  <input
                    type="tel" name="celular" value={form.celular}
                    onChange={handleChange} required placeholder="1234-5678"
                    className={inputClass}
                  />
                </Campo>
              </div>
            </div>
          </section>

          {/* Dirección */}
          <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-gray-900">Dirección de envío</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Provincia *">
                <select
                  name="provincia" value={form.provincia}
                  onChange={handleChange} required
                  className={`${inputClass} ${form.provincia ? "" : "text-gray-400"}`}
                >
                  <option value="" disabled>Elegí tu provincia</option>
                  {PROVINCIAS.map((p) => (
                    <option key={p} value={p} className="text-gray-900">{p}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Localidad *">
                <input
                  type="text" name="localidad" value={form.localidad}
                  onChange={handleChange} required placeholder="Palermo"
                  className={inputClass}
                />
              </Campo>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="col-span-2 sm:col-span-2">
                <Campo label="Calle *">
                  <input
                    type="text" name="calle" value={form.calle}
                    onChange={handleChange} required placeholder="Av. Corrientes"
                    className={inputClass}
                  />
                </Campo>
              </div>
              <Campo label="Número *">
                <input
                  type="text" name="numero" value={form.numero}
                  onChange={handleChange} required placeholder="1234"
                  className={inputClass}
                />
              </Campo>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Campo label="Piso">
                <input
                  type="text" name="piso" value={form.piso}
                  onChange={handleChange} placeholder="3"
                  className={inputClass}
                />
              </Campo>
              <Campo label="Departamento">
                <input
                  type="text" name="departamento" value={form.departamento}
                  onChange={handleChange} placeholder="B"
                  className={inputClass}
                />
              </Campo>
              <Campo label="Código postal *">
                <input
                  type="text" name="codigoPostal" value={form.codigoPostal}
                  onChange={handleChange} required placeholder="1043"
                  className={inputClass}
                />
              </Campo>
            </div>

            <Campo label="Observaciones">
              <textarea
                name="observaciones" value={form.observaciones}
                onChange={handleChange}
                placeholder="Timbre roto, dejar en portería, etc."
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </Campo>
          </section>

          {/* Parche estampado — uno por camiseta */}
          {precioEstampa > 0 && elegibles.length > 0 && (
            <section className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Parche estampado</h2>
                <p className="text-sm text-gray-500">Agregá un parche estampado a las camisetas que quieras ({formatearPrecio(precioEstampa)} c/u).</p>
              </div>

              {elegibles.map((it) => {
                const k = itemKey(it);
                const p = parches[k] ?? { activo: false, detalle: "" };
                return (
                  <div key={k} className="border border-gray-200 rounded-lg p-3 bg-white flex flex-col gap-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.activo}
                        onChange={(e) => setParches((prev) => ({ ...prev, [k]: { ...p, activo: e.target.checked } }))}
                        className="mt-1 w-5 h-5 accent-orange-500 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">
                          {it.nombre} <span className="text-gray-500 font-normal">· Talle {it.talle}</span>
                        </p>
                        <p className="text-xs text-orange-500 font-semibold">+{formatearPrecio(precioEstampa)}</p>
                      </div>
                    </label>
                    {p.activo && (
                      <textarea
                        value={p.detalle}
                        onChange={(e) => setParches((prev) => ({ ...prev, [k]: { ...p, detalle: e.target.value } }))}
                        placeholder="¿Qué querés estampar? Ej: nombre 'GARCÍA', número 10..."
                        rows={2}
                        className={`${inputClass} resize-none`}
                      />
                    )}
                  </div>
                );
              })}
            </section>
          )}

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {/* Botones de pago */}
          <div className="flex flex-col gap-3">
            <button
              type="submit"
              disabled={cargando || cargandoTransf}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 text-black font-bold py-4 rounded-xl text-lg hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <FaCreditCard className="text-base" />
              {cargando ? "Procesando..." : "Tarjeta o Mercado Pago"}
            </button>

            <button
              type="button"
              onClick={handleTransferencia}
              disabled={cargando || cargandoTransf}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <FaWhatsapp className="text-xl" />
              {cargandoTransf ? "Registrando..." : "Pagar por transferencia"}
            </button>

            <p className="text-xs text-gray-500 text-center">
              Al pagar por transferencia te abrimos WhatsApp con los datos. Confirmamos tu pedido cuando recibamos el pago.
            </p>
          </div>
        </form>

        {/* Resumen del pedido */}
        <aside className="lg:w-80 shrink-0 order-first lg:order-last">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 sticky top-24">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Resumen del pedido</h2>

            <div className="flex flex-col gap-3 mb-4">
              {items.map((item) => (
                <div key={`${item.id}-${item.talle}`} className="flex items-center gap-3">
                  {item.imagen && (
                    <div className="shrink-0 w-12 h-12 rounded-lg bg-white overflow-hidden">
                      <img src={item.imagen} alt={item.nombre} className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-500">Talle {item.talle} · x{item.cantidad}</p>
                  </div>
                  <p className="text-sm text-orange-500 font-bold shrink-0">
                    {formatearPrecio(item.precio * item.cantidad)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-3 flex flex-col gap-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatearPrecio(total)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Envío</span>
                <span>{!form.provincia ? "Elegí tu provincia" : precioEnvio > 0 ? formatearPrecio(precioEnvio) : "—"}</span>
              </div>
              {costoEstampa > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Parche estampado x{seleccionados.length}</span>
                  <span>{formatearPrecio(costoEstampa)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-900 font-bold text-base border-t border-gray-200 pt-2 mt-1">
                <span>Total</span>
                <span className="text-orange-500">{formatearPrecio(totalConEnvio)}</span>
              </div>
            </div>
          </div>
        </aside>

      </div>
    </main>
  );
}
