"use client";

import { useEffect, useRef, useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { MAX_CUOTAS } from "@/lib/cuotas";

// Formulario de la tarjeta de Mercado Pago ("Card Payment Brick") dentro de
// Finalizar compra, para no mandar al comprador a la página de Mercado Pago.
// Los datos de la tarjeta los carga y guarda Mercado Pago (la web solo recibe
// un token). La public key no es secreta: va en la página igual que el píxel.
export const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || "APP_USR-d4f9ec63-3867-4bf7-8b40-40f927697f2c";

function cargarScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      if (src.includes("sdk.mercadopago") && !window.MercadoPago) {
        document.querySelector(`script[src="${src}"]`).addEventListener("load", resolve);
      } else resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });
}

// monto: total a cobrar (se usa para mostrar las cuotas). onPagar(formData)
// devuelve una promesa: si se rechaza, el formulario deja volver a intentar.
export default function PagoTarjeta({ monto, email, onPagar }) {
  const [listo, setListo] = useState(false);
  const [falla, setFalla] = useState(false);
  // El formulario se crea una vez por monto: onPagar siempre lee la versión más nueva
  const pagarRef = useRef(onPagar);
  pagarRef.current = onPagar;

  useEffect(() => {
    let cancelado = false;
    let controlador = null;
    setListo(false);

    (async () => {
      try {
        // security.js genera el "device id" que ayuda a que se aprueben los pagos
        cargarScript("https://www.mercadopago.com/v2/security.js", { view: "checkout" }).catch(() => {});
        await cargarScript("https://sdk.mercadopago.com/js/v2");
        if (cancelado) return;
        const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "es-AR" });
        const c = await mp.bricks().create("cardPayment", "pago-tarjeta", {
          initialization: { amount: monto, ...(email ? { payer: { email } } : {}) },
          customization: {
            paymentMethods: { maxInstallments: MAX_CUOTAS },
          },
          callbacks: {
            onReady: () => { if (!cancelado) setListo(true); },
            onSubmit: (formData) => pagarRef.current(formData),
            onError: (error) => console.error("[pago tarjeta]", error),
          },
        });
        if (cancelado) c.unmount();
        else controlador = c;
      } catch (err) {
        console.error("[pago tarjeta] No se pudo cargar:", err);
        if (!cancelado) setFalla(true);
      }
    })();

    return () => {
      cancelado = true;
      try { controlador?.unmount(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monto]);

  if (falla) {
    return <p className="text-sm text-red-600">No se pudo cargar el formulario de la tarjeta. Recargá la página o pagá por transferencia.</p>;
  }
  return (
    <div>
      {!listo && (
        <div className="flex justify-center py-6">
          <FaSpinner className="text-orange-500 text-2xl animate-spin" />
        </div>
      )}
      <div id="pago-tarjeta" />
    </div>
  );
}
