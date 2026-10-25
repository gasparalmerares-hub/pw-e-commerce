"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";
import { FaChevronRight, FaCreditCard, FaWhatsapp } from "react-icons/fa";
import { trackInitiateCheckout } from "@/lib/fbpixel";
import { gaEvent, gaItems } from "@/lib/ga";
import { PROVINCIAS, precioEnvioPara } from "@/lib/envio";
import { textoPersonalizacion } from "@/lib/personalizacion";
import PagoTarjeta, { MP_PUBLIC_KEY } from "@/components/PagoTarjeta";
import { conCodigo, normalizarCodigo } from "@/lib/codigos";

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

const CARRITO_KEY = "zeus_carrito_id";

function carritoGuardado() {
  try { return localStorage.getItem(CARRITO_KEY); } catch { return null; }
}

function olvidarCarrito() {
  try { localStorage.removeItem(CARRITO_KEY); } catch {}
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
  // Parche por item: map keyed por `${id}-${talle}` → { activo, nombre, numero }
  const [parches,          setParches]          = useState({});
  const [cargando,         setCargando]         = useState(false);
  const [cargandoTransf,   setCargandoTransf]   = useState(false);
  const [error,            setError]            = useState(null);
  // Pago con tarjeta dentro de la página (components/PagoTarjeta.js)
  const [pagoTarjeta,      setPagoTarjeta]      = useState(false);
  const [errorTarjeta,     setErrorTarjeta]     = useState(null);
  // Código de descuento aplicado: { codigo, porcentaje } (ver lib/codigos.js)
  const [codigo,           setCodigo]           = useState(null);
  const [codigoTexto,      setCodigoTexto]      = useState("");
  const [codigoError,      setCodigoError]      = useState(null);
  const [aplicandoCodigo,  setAplicandoCodigo]  = useState(false);
  const pedidoTarjeta = useRef(null);
  const formRef       = useRef(null);

  // Carrito abandonado: apenas hay teléfono o mail, se guarda (con un par de
  // segundos de espera) para poder contactar a quien no termine la compra.
  // Se borra solo al crear el pedido (ver /api/carritos).
  const pedidoCreado = useRef(false);
  useEffect(() => {
    if (!items.length || pedidoCreado.current) return;
    const telefono = `${form.codigoArea}${form.celular}`.replace(/\D/g, "");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim()) && telefono.length < 8) return;
    const t = setTimeout(() => {
      if (pedidoCreado.current) return;
      const id = carritoGuardado();
      fetch("/api/carritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, nombre: form.nombre, email: form.email, telefono, provincia: form.provincia, localidad: form.localidad, items }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.id && !pedidoCreado.current) try { localStorage.setItem(CARRITO_KEY, d.id); } catch {} })
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [items, form.nombre, form.email, form.codigoArea, form.celular, form.provincia, form.localidad]);

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
  // El parche es por unidad: 2 camisetas iguales pueden llevar nombres distintos
  // y se cobra una estampa por cada una. Clave: `${id}-${talle}#${unidad}`.
  const itemKey      = (it) => `${it.id}-${it.talle}`;
  const elegibles    = items.filter((it) => it.tabla === "productos_catalogo");
  const unidades     = elegibles.flatMap((it) =>
    Array.from({ length: Number(it.cantidad) || 1 }, (_, u) => ({ it, u, k: `${itemKey(it)}#${u}` }))
  );
  const conParche    = unidades.filter(({ k }) => parches[k]?.activo);
  const costoEstampa = conParche.length * precioEstampa;

  // Con código de descuento cada camiseta baja ese porcentaje (envío y parches no)
  const pct = codigo?.porcentaje ?? 0;
  const subtotalProductos = items.reduce((s, i) => s + conCodigo(i.precio, pct) * i.cantidad, 0);

  // Nombre y número a estampar de una unidad (vacíos si no hay)
  const persDe = (k) => ({
    nombre: (parches[k]?.nombre ?? "").trim(),
    numero: (parches[k]?.numero ?? "").trim(),
  });

  // Lista de parches con detalle (uno por unidad), para el backend y WhatsApp
  const parchesPayload = conParche.map(({ it, k }) => ({
    nombre: it.nombre,
    talle: it.talle,
    detalle: textoPersonalizacion(persDe(k)),
  }));
  const parchesIncompletos = conParche.some(({ k }) => !textoPersonalizacion(persDe(k)));

  // Cada item lleva la personalización de cada unidad (null = sin parche), así
  // el panel de Encargos arma una imagen por camiseta para el proveedor.
  const itemsConPers = items.map((it) => {
    if (it.tabla !== "productos_catalogo") return it;
    const personalizaciones = Array.from({ length: Number(it.cantidad) || 1 }, (_, u) => {
      const k = `${itemKey(it)}#${u}`;
      return parches[k]?.activo ? persDe(k) : null;
    });
    return personalizaciones.some(Boolean) ? { ...it, personalizaciones } : it;
  });

  // Disparar InitiateCheckout cuando hay items y el componente está listo.
  useEffect(() => {
    if (items.length === 0) return;
    trackInitiateCheckout({ items, total: total + precioEnvio + costoEstampa });
    // Sin precioEnvio en las dependencias: cambiar de provincia no debe
    // volver a disparar el evento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, costoEstampa]);

  // Embudo en Google Analytics: además de begin_checkout (arriba) y purchase,
  // avisa cuando completó todos los datos de envío (una vez) y qué forma de
  // pago tocó. Así se ve en qué paso se va la gente.
  const datosCompletos = !!(
    form.nombre && form.email && form.codigoArea && form.celular &&
    form.provincia && form.localidad && form.calle && form.numero && form.codigoPostal
  );
  const envioAvisado = useRef(false);
  useEffect(() => {
    if (!datosCompletos || envioAvisado.current || !items.length) return;
    envioAvisado.current = true;
    gaEvent("add_shipping_info", {
      currency: "ARS", value: total + precioEnvio + costoEstampa,
      shipping_tier: form.provincia, items: gaItems(items),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datosCompletos]);

  function avisarPago(tipo) {
    gaEvent("add_payment_info", {
      currency: "ARS", value: total + precioEnvio + costoEstampa,
      payment_type: tipo, items: gaItems(items),
    });
  }

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

  async function handleSubmit(e) {
    e.preventDefault();
    if (parchesIncompletos) {
      setError("Completá el nombre o el número a estampar en cada camiseta con parche.");
      return;
    }
    // Con la public key de Mercado Pago, el formulario de la tarjeta aparece
    // acá mismo; sin ella, se sigue yendo a la página de Mercado Pago.
    if (MP_PUBLIC_KEY) {
      avisarPago("tarjeta");
      setError(null);
      setPagoTarjeta(true);
      setTimeout(() => document.getElementById("seccion-tarjeta")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      return;
    }
    irAMercadoPago();
  }

  // Lo llama el formulario de la tarjeta al tocar "Pagar". Si la tarjeta se
  // rechaza, muestra el motivo y lanza un error para que se pueda reintentar
  // (con el mismo pedido). Si se aprueba o queda en revisión, va a la página
  // de éxito como si volviera de Mercado Pago.
  async function pagarConTarjeta(formData) {
    setErrorTarjeta(null);
    let data = {};
    try {
      const res = await fetch("/api/pagos/tarjeta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsConPers, comprador: form, parches: parchesPayload, carritoId: carritoGuardado(),
          pedidoId: pedidoTarjeta.current, pago: formData, deviceId: window.MP_DEVICE_SESSION_ID,
          codigo: codigo?.codigo,
        }),
      });
      data = await res.json();
    } catch {}

    if (data.pedidoId) {
      // El pedido ya existe (el servidor borró el carrito guardado)
      pedidoTarjeta.current = data.pedidoId;
      pedidoCreado.current = true;
      olvidarCarrito();
    }
    if (["approved", "authorized", "in_process", "pending"].includes(data.status)) {
      try {
        localStorage.setItem("pendingPurchase", JSON.stringify({
          items, total: subtotalProductos + precioEnvio + costoEstampa, ts: Date.now(),
        }));
      } catch {}
      window.location.href = `/checkout/exito?status=${data.status}&external_reference=${data.pedidoId}&payment_id=${data.paymentId}`;
      return;
    }
    if (data.codigoInvalido) quitarCodigo(data.error);
    setErrorTarjeta(data.mensaje || data.error || "No pudimos procesar el pago. Revisá tu conexión e intentá de nuevo.");
    document.getElementById("seccion-tarjeta")?.scrollIntoView({ behavior: "smooth", block: "start" });
    throw new Error(data.status || "error");
  }

  // Pago en la página de Mercado Pago (con la cuenta de Mercado Pago)
  async function irAMercadoPago() {
    avisarPago("mercadopago");
    setCargando(true);
    setError(null);

    try {
      const res = await fetch("/api/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsConPers, comprador: form, parches: parchesPayload, carritoId: carritoGuardado(), codigo: codigo?.codigo }),
      });

      const data = await res.json();

      if (data.codigoInvalido) quitarCodigo(data.error);
      if (!res.ok) throw new Error(data.error || "Error al procesar el pago");
      pedidoCreado.current = true;
      olvidarCarrito();

      // Guardar resumen para disparar Purchase en /checkout/exito al volver de MP
      try {
        localStorage.setItem("pendingPurchase", JSON.stringify({
          items, total: subtotalProductos + precioEnvio + costoEstampa, ts: Date.now(),
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
    if (!datosCompletos) {
      setError("Completá todos los campos obligatorios antes de continuar.");
      return;
    }
    if (parchesIncompletos) {
      setError("Completá el nombre o el número a estampar en cada camiseta con parche.");
      return;
    }
    avisarPago("transferencia");
    setCargandoTransf(true);
    setError(null);

    try {
      // Calcular precios con descuento por transferencia por item
      const itemsTransf = itemsConPers.map((i) => {
        const desc = Number(i.descuentoTransferencia) || 0;
        const precioTransf = Math.round(i.precio * (1 - desc / 100));
        return { ...i, precioTransf, descuentoTransferencia: desc };
      });
      // El código se suma al descuento por transferencia (el servidor lo vuelve a calcular)
      const subtotalTransf = itemsTransf.reduce((s, i) => s + conCodigo(i.precioTransf, pct) * i.cantidad, 0);
      const totalFinal     = subtotalTransf + precioEnvio + costoEstampa;

      const res = await fetch("/api/pedidos/transferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsTransf, comprador: form, parches: parchesPayload, carritoId: carritoGuardado(), codigo: codigo?.codigo }),
      });

      const data = await res.json();

      if (data.codigoInvalido) quitarCodigo(data.error);
      if (!res.ok) throw new Error(data.error || "Error al registrar el pedido");
      pedidoCreado.current = true;
      olvidarCarrito();

      const resumen = itemsTransf
        .map((i) => `• ${i.nombre} T.${i.talle} x${i.cantidad} = ${formatearPrecio(conCodigo(i.precioTransf, pct) * i.cantidad)}${i.descuentoTransferencia > 0 ? ` _(−${i.descuentoTransferencia}% transf.)_` : ""}`)
        .join("\n");
      const parchesTxt = parchesPayload
        .map((p) => `Parche en ${p.nombre} T.${p.talle}: ${p.detalle} (+${formatearPrecio(precioEstampa)})`)
        .join("\n");
      const msg =
        `Hola! Quiero pagar por transferencia.\n\n` +
        `*Pedido #${data.id}*\n${resumen}\n` +
        (parchesPayload.length ? `\n*Parches estampados:*\n${parchesTxt}\n` : "") +
        (codigo ? `\nCódigo de descuento: *${codigo.codigo}* (−${codigo.porcentaje}%)\n` : "") +
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

  const totalConEnvio = subtotalProductos + precioEnvio + costoEstampa;
  // Cuánto se ahorra pagando por transferencia (mismo cálculo que handleTransferencia)
  const ahorroTransf = subtotalProductos - items.reduce((s, i) =>
    s + conCodigo(Math.round(i.precio * (1 - (Number(i.descuentoTransferencia) || 0) / 100)), pct) * i.cantidad, 0);

  async function aplicarCodigo(e) {
    e.preventDefault();
    const texto = normalizarCodigo(codigoTexto);
    if (!texto) return;
    setAplicandoCodigo(true);
    setCodigoError(null);
    try {
      const res = await fetch("/api/codigos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: texto, email: form.email }),
      });
      const d = await res.json();
      if (d.codigo) { setCodigo({ codigo: d.codigo, porcentaje: d.porcentaje }); setCodigoTexto(""); }
      else setCodigoError(d.error || "Ese código no es válido.");
    } catch {
      setCodigoError("No se pudo revisar el código. Probá de nuevo.");
    }
    setAplicandoCodigo(false);
  }

  function quitarCodigo(motivo = null) {
    setCodigo(null);
    setCodigoError(motivo);
  }

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
        <div className="flex-1 flex flex-col gap-6">
          <form id="form-checkout" ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-6">

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

                {unidades.map(({ it, u, k }) => {
                  const p = parches[k] ?? { activo: false, nombre: "", numero: "" };
                  const cantidad = Number(it.cantidad) || 1;
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
                            {cantidad > 1 && <span className="text-gray-500 font-normal"> · camiseta {u + 1} de {cantidad}</span>}
                          </p>
                          <p className="text-xs text-orange-500 font-semibold">+{formatearPrecio(precioEstampa)}</p>
                        </div>
                      </label>
                      {p.activo && (
                        <div className="grid grid-cols-3 gap-3">
                          <div className="col-span-2">
                            <Campo label="Nombre">
                              <input
                                type="text" value={p.nombre ?? ""} maxLength={20}
                                onChange={(e) => setParches((prev) => ({ ...prev, [k]: { ...p, nombre: e.target.value } }))}
                                placeholder="GARCÍA"
                                className={inputClass}
                              />
                            </Campo>
                          </div>
                          <Campo label="Número">
                            <input
                              type="text" inputMode="numeric" value={p.numero ?? ""} maxLength={3}
                              onChange={(e) => setParches((prev) => ({ ...prev, [k]: { ...p, numero: e.target.value.replace(/\D/g, "") } }))}
                              placeholder="10"
                              className={inputClass}
                            />
                          </Campo>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
          </form>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {/* Botones de pago */}
          <div className="flex flex-col gap-3">
            {ahorroTransf > 0 && (
              <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-center">
                💸 Pagando por transferencia ahorrás <strong>{formatearPrecio(ahorroTransf)}</strong>: te queda en{" "}
                <strong>{formatearPrecio(totalConEnvio - ahorroTransf)}</strong>{form.provincia ? "" : " + envío"}.
              </p>
            )}

            {!pagoTarjeta ? (
              <button
                type="submit"
                form="form-checkout"
                disabled={cargando || cargandoTransf}
                className="w-full flex items-center justify-center gap-2 bg-orange-500 text-black font-bold py-4 rounded-xl text-lg hover:bg-orange-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                <FaCreditCard className="text-base" />
                {cargando ? "Procesando..." : MP_PUBLIC_KEY ? "Pagar con tarjeta" : "Tarjeta o Mercado Pago"}
              </button>
            ) : (
              <section id="seccion-tarjeta" className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex flex-col gap-3 scroll-mt-24">
                <h2 className="text-lg font-bold text-gray-900">Pagá con tu tarjeta de débito o crédito</h2>
                {errorTarjeta && (
                  <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{errorTarjeta}</p>
                )}
                <PagoTarjeta monto={totalConEnvio} email={form.email} onPagar={pagarConTarjeta} />
                <button
                  type="button"
                  onClick={() => { if (formRef.current?.reportValidity()) irAMercadoPago(); }}
                  disabled={cargando || cargandoTransf}
                  className="text-sm text-gray-500 underline hover:text-gray-800 disabled:opacity-50"
                >
                  {cargando ? "Abriendo Mercado Pago..." : "Prefiero pagar con mi cuenta de Mercado Pago"}
                </button>
              </section>
            )}

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

            <a
              href={`https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent("Hola! Tengo una duda con mi compra en la web.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-green-700 font-semibold hover:underline"
            >
              <FaWhatsapp className="text-base" />
              ¿Dudas? Escribinos por WhatsApp
            </a>
          </div>
        </div>

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

            {/* Código de descuento */}
            <div className="border-t border-gray-200 pt-3 mb-3">
              {codigo ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-green-700 font-semibold">Código {codigo.codigo} aplicado (−{codigo.porcentaje}%)</span>
                  <button type="button" onClick={() => quitarCodigo()} className="text-xs text-gray-500 underline hover:text-gray-800">
                    Quitar
                  </button>
                </div>
              ) : (
                <form onSubmit={aplicarCodigo} className="flex gap-2">
                  <input
                    type="text" value={codigoTexto} onChange={(e) => setCodigoTexto(e.target.value)}
                    placeholder="Código de descuento" aria-label="Código de descuento"
                    className={`${inputClass} flex-1 min-w-0 uppercase text-sm`}
                  />
                  <button
                    type="submit" disabled={aplicandoCodigo || !codigoTexto.trim()}
                    className="shrink-0 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
                  >
                    {aplicandoCodigo ? "..." : "Aplicar"}
                  </button>
                </form>
              )}
              {codigoError && <p className="text-xs text-red-600 mt-1">{codigoError}</p>}
            </div>

            <div className="border-t border-gray-200 pt-3 flex flex-col gap-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatearPrecio(total)}</span>
              </div>
              {codigo && total > subtotalProductos && (
                <div className="flex justify-between gap-2 text-sm text-green-700">
                  <span>Descuento −{codigo.porcentaje}%</span>
                  <span className="whitespace-nowrap">−{formatearPrecio(total - subtotalProductos)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-500">
                <span>Envío</span>
                <span>{!form.provincia ? "Elegí tu provincia" : precioEnvio > 0 ? formatearPrecio(precioEnvio) : "—"}</span>
              </div>
              {costoEstampa > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Parche estampado x{conParche.length}</span>
                  <span>{formatearPrecio(costoEstampa)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-900 font-bold text-base border-t border-gray-200 pt-2 mt-1">
                <span>Total</span>
                <span className="text-orange-500">{formatearPrecio(totalConEnvio)}</span>
              </div>
              {ahorroTransf > 0 && (
                <div className="flex justify-between text-sm text-green-700 font-semibold">
                  <span>Por transferencia</span>
                  <span>{formatearPrecio(totalConEnvio - ahorroTransf)}</span>
                </div>
              )}
            </div>
          </div>
        </aside>

      </div>
    </main>
  );
}
