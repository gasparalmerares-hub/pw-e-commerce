// Solo servidor. Lo comparten las dos formas de pagar con Mercado Pago:
// /api/create-preference (te lleva a la página de Mercado Pago) y
// /api/pagos/tarjeta (formulario de la tarjeta dentro de Finalizar compra).
// Así el precio que se cobra y el pedido que se guarda son siempre iguales.

import { supabaseAdmin } from "@/lib/supabase";
import { precioEnvioPara } from "@/lib/envio";
import { atribucionDesdeRequest, conAtribucion } from "@/lib/metaAtribucion";
import { borrarCarrito } from "@/lib/carritosServidor";

async function leerConfig() {
  try {
    const { data } = await supabaseAdmin()
      .from("configuracion")
      .select("clave, valor")
      .in("clave", ["precio_envio", "precio_envio_provincias", "precio_estampa"]);
    return Object.fromEntries((data ?? []).map(({ clave, valor }) => [clave, valor]));
  } catch {
    return {};
  }
}

// Envío según la provincia + parches estampados + productos
export async function calcularTotales(items, comprador, parches) {
  const parchesArr = Array.isArray(parches) ? parches : [];
  const config = await leerConfig();
  const precioEnvio = precioEnvioPara(config, comprador?.provincia);
  const precioEstampaUnit = parchesArr.length ? parseInt(config.precio_estampa) || 0 : 0;
  const costoEstampa = parchesArr.length * precioEstampaUnit;
  const total = items.reduce((sum, i) => sum + Number(i.precio) * Number(i.cantidad), 0) + precioEnvio + costoEstampa;
  const parchesTxt = parchesArr.map((p) => `${p.nombre} T.${p.talle}: ${p.detalle}`).join(" | ");
  return { parchesArr, parchesTxt, precioEnvio, precioEstampaUnit, costoEstampa, total };
}

// Guarda el pedido "pendiente" antes de cobrar y borra el carrito abandonado
// que había guardado la web. Devuelve el id, o null si no se pudo guardar.
export async function crearPedidoPendiente(request, { items, comprador, carritoId, totales }) {
  try {
    const { data } = await supabaseAdmin()
      .from("pedidos")
      .insert({
        nombre:        comprador.nombre,
        email:         comprador.email,
        telefono:      `${comprador.codigoArea ?? ""}${comprador.celular ?? ""}`,
        provincia:     comprador.provincia ?? "",
        localidad:     comprador.localidad ?? "",
        calle:         comprador.calle ?? "",
        numero:        comprador.numero ?? "",
        piso:          comprador.piso ?? "",
        departamento:  comprador.departamento ?? "",
        codigo_postal: comprador.codigoPostal ?? "",
        // Al final van los datos para que Meta atribuya la compra (ver lib/metaAtribucion.js)
        observaciones: conAtribucion(
          `${totales.parchesArr.length ? `[PARCHES ESTAMPADOS → ${totales.parchesTxt}] ` : ""}${comprador.observaciones ?? ""}`.trim(),
          atribucionDesdeRequest(request)
        ),
        items,
        total:  totales.total,
        estado: "pendiente",
      })
      .select("id")
      .single();
    const pedidoId = data?.id ?? null;
    // El carrito abandonado guardado mientras completaba los datos ya no hace falta
    if (pedidoId) await borrarCarrito(carritoId);
    return pedidoId;
  } catch (e) {
    console.error("Error saving pedido (no bloqueante):", e);
    return null;
  }
}

// Detalle del pedido como lo pide Mercado Pago (productos, envío y parches)
export function itemsParaMP(items, totales) {
  return [
    ...items.map((item) => ({
      id: String(item.id),
      title: `${item.nombre} - Talle ${item.talle}`,
      quantity: Number(item.cantidad),
      unit_price: Number(item.precio),
      currency_id: "ARS",
      ...(item.imagen ? { picture_url: item.imagen } : {}),
    })),
    {
      id: "envio",
      title: "Envío",
      quantity: 1,
      unit_price: Number(totales.precioEnvio),
      currency_id: "ARS",
    },
    ...(totales.parchesArr.length > 0 ? [{
      id: "estampa",
      title: `Parche estampado (x${totales.parchesArr.length})`,
      quantity: totales.parchesArr.length,
      unit_price: Number(totales.precioEstampaUnit),
      currency_id: "ARS",
    }] : []),
  ];
}

// La URL pública por la que entró la request. MercadoPago NO sigue redirects
// en el webhook: si el notification_url apunta a un dominio que redirige
// (www ↔ sin www), el pago nunca se registra. NEXT_PUBLIC_URL queda solo
// como respaldo (desarrollo local).
export function urlBase(request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return host && !host.startsWith("localhost")
    ? `https://${host}`
    : (process.env.NEXT_PUBLIC_URL ?? "").replace(/\/$/, "");
}
