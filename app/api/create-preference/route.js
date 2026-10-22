import MercadoPago, { Preference } from "mercadopago";
import { unstable_noStore as noStore } from "next/cache";
import { MAX_CUOTAS } from "@/lib/cuotas";
import { calcularTotales, crearPedidoPendiente, itemsParaMP, urlBase } from "@/lib/pedidoTienda";

export const dynamic = "force-dynamic";

// Pago en la página de Mercado Pago (Checkout Pro). Desde que el checkout
// tiene el formulario de la tarjeta adentro (/api/pagos/tarjeta), esto queda
// para "Pagar con mi cuenta de Mercado Pago" y por si falta la public key.
export async function POST(request) {
  noStore();
  if (!process.env.MP_ACCESS_TOKEN) {
    return Response.json(
      { error: "El servicio de pagos aún no está configurado. Contactanos por WhatsApp." },
      { status: 503 }
    );
  }

  try {
    const { items, comprador, parches, carritoId } = await request.json();
    const baseUrl = urlBase(request);
    const totales = await calcularTotales(items, comprador, parches);

    // Guardar pedido en Supabase antes de redirigir a MP
    const pedidoId = await crearPedidoPendiente(request, { items, comprador, carritoId, totales });

    const client = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: itemsParaMP(items, totales),
        payer: {
          name: comprador.nombre,
          email: comprador.email,
          phone: { area_code: comprador.codigoArea || "", number: comprador.celular || "" },
          address: {
            street_name: comprador.calle || "",
            street_number: parseInt(comprador.numero) || 0,
            zip_code: comprador.codigoPostal || "",
          },
        },
        back_urls: {
          success: `${baseUrl}/checkout/exito`,
          failure: `${baseUrl}/checkout/error`,
          pending: `${baseUrl}/checkout/exito`,
        },
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" },
            { id: "atm" },
          ],
          // Cuotas con interés a cargo del comprador (ver lib/cuotas.js)
          installments: MAX_CUOTAS,
        },
        auto_return: "approved",
        notification_url: `${baseUrl}/api/webhook`,
        ...(pedidoId ? { external_reference: pedidoId } : {}),
      },
    });

    return Response.json({ url: result.init_point });
  } catch (err) {
    console.error("Error creando preferencia MP:", err);
    return Response.json({ error: "Error al iniciar el pago. Intentá de nuevo." }, { status: 500 });
  }
}
