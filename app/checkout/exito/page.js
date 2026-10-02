"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FaCheckCircle, FaWhatsapp } from "react-icons/fa";
import { useCart } from "@/context/CartContext";
import { trackPurchase } from "@/lib/fbpixel";

const WHATSAPP_ADMIN = "5492216220145";

function formatearPrecio(precio) {
  return "$" + Number(precio).toLocaleString("es-AR");
}

export default function CheckoutExitoPage() {
  const { vaciarCarrito } = useCart();
  const [waUrl, setWaUrl] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pendingPurchase");
      if (raw) {
        const { items, total, ts } = JSON.parse(raw);
        if (items && total && ts && Date.now() - ts < 60 * 60 * 1000) {
          const url = new URL(window.location.href);
          const pedidoId = url.searchParams.get("external_reference") ?? null;
          // Mercado Pago también vuelve acá con pagos pendientes: esos los
          // informa el servidor (Conversions API) recién cuando se aprueban.
          const estadoMP = url.searchParams.get("collection_status") ?? url.searchParams.get("status");
          if (!estadoMP || estadoMP === "approved") trackPurchase({ items, total, pedidoId });

          // Armar mensaje de WhatsApp para el admin
          const resumen = items
            .map((i) => `• ${i.nombre} T.${i.talle} x${i.cantidad} = ${formatearPrecio(i.precio * i.cantidad)}`)
            .join("\n");
          const msg =
            `🛒 *Nuevo pedido con MercadoPago*\n` +
            (pedidoId ? `Pedido #${pedidoId}\n` : "") +
            `\n${resumen}\n` +
            `*Total: ${formatearPrecio(total)}*`;
          setWaUrl(`https://wa.me/${WHATSAPP_ADMIN}?text=${encodeURIComponent(msg)}`);
        }
        localStorage.removeItem("pendingPurchase");
      }
    } catch {}
    vaciarCarrito();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="max-w-xl mx-auto px-4 py-20 text-center">
      <FaCheckCircle className="text-green-500 text-6xl mx-auto mb-6" />
      <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">¡Pago exitoso!</h1>
      <p className="text-gray-500 mb-2">Tu compra fue procesada correctamente.</p>
      <p className="text-gray-500 mb-10">
        Nos ponemos en contacto a la brevedad para coordinar el envío.
      </p>
      <div className="flex flex-col items-center gap-4">
        <Link
          href="/"
          className="inline-block bg-orange-500 text-black font-semibold px-8 py-4 rounded-xl hover:bg-orange-400 transition-colors"
        >
          Volver al inicio
        </Link>
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-600 transition-colors"
          >
            <FaWhatsapp />
            Avisarle al vendedor por WhatsApp
          </a>
        )}
      </div>
    </main>
  );
}
