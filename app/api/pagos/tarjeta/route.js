import MercadoPago, { Payment } from "mercadopago";
import { randomUUID } from "crypto";
import { unstable_noStore as noStore } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase";
import { esUUID } from "@/lib/carritosServidor";
import { calcularTotales, crearPedidoPendiente, itemsParaMP, urlBase } from "@/lib/pedidoTienda";
import { codigoDelPedido } from "@/lib/codigosServidor";

export const dynamic = "force-dynamic";

// Pago con tarjeta desde el formulario que está dentro de Finalizar compra
// (components/PagoTarjeta.js, "Card Payment Brick" de Mercado Pago). El
// formulario no manda el número de la tarjeta: Mercado Pago lo cambia por un
// token. Acá se guarda el pedido "pendiente" (o se reusa el del intento
// anterior si la tarjeta fue rechazada) y se crea el pago con el precio
// calculado en el servidor. Si se aprueba, lo demás (stock, mail, Meta,
// TikTok, Analytics) lo hace /api/webhook, igual que con la página de MP.

// Qué le decimos al comprador según el motivo del rechazo
const RECHAZOS = {
  cc_rejected_bad_filled_card_number:   "Revisá el número de la tarjeta.",
  cc_rejected_bad_filled_date:          "Revisá la fecha de vencimiento.",
  cc_rejected_bad_filled_security_code: "Revisá el código de seguridad.",
  cc_rejected_bad_filled_other:         "Revisá los datos de la tarjeta.",
  cc_rejected_insufficient_amount:      "La tarjeta no tiene saldo o límite suficiente. Probá con otra o pagá por transferencia.",
  cc_rejected_call_for_authorize:       "Tu banco pide que autorices este pago: llamá al número que está atrás de la tarjeta y volvé a intentar.",
  cc_rejected_card_disabled:            "La tarjeta no está activada. Activala con tu banco o probá con otra.",
  cc_rejected_invalid_installments:     "La tarjeta no acepta esa cantidad de cuotas. Probá con menos cuotas.",
  cc_rejected_duplicated_payment:       "Ya hiciste un pago igual hace un momento. Si necesitás pagar de nuevo, usá otra tarjeta.",
  cc_rejected_max_attempts:             "Llegaste al límite de intentos con esta tarjeta. Probá con otra.",
  cc_rejected_high_risk:                "Mercado Pago rechazó el pago por seguridad. Probá con otra tarjeta o pagá por transferencia.",
  cc_rejected_blacklist:                "Mercado Pago rechazó el pago por seguridad. Probá con otra tarjeta o pagá por transferencia.",
};
const RECHAZO_GENERICO = "La tarjeta rechazó el pago. Probá con otra o pagá por transferencia.";

export async function POST(request) {
  noStore();
  if (!process.env.MP_ACCESS_TOKEN) {
    return Response.json({ error: "El servicio de pagos aún no está configurado. Contactanos por WhatsApp." }, { status: 503 });
  }

  let pedidoId = null;
  try {
    const { items, comprador, parches, carritoId, pedidoId: pedidoAnterior, pago, deviceId, codigo: codigoTexto } = await request.json();
    if (!Array.isArray(items) || !items.length || !comprador?.email || !pago?.token || !pago?.payment_method_id) {
      return Response.json({ error: "Faltan datos del pago." }, { status: 400 });
    }
    const { codigo, error: errorCodigo } = await codigoDelPedido(codigoTexto, comprador?.email);
    if (errorCodigo) return Response.json({ error: errorCodigo, codigoInvalido: true }, { status: 400 });

    const baseUrl = urlBase(request);
    const totales = await calcularTotales(items, comprador, parches, codigo);

    // Si la tarjeta anterior fue rechazada se reusa el mismo pedido (mientras
    // siga pendiente y por el mismo total); si no, se crea uno nuevo.
    if (esUUID(pedidoAnterior)) {
      const { data } = await supabaseAdmin().from("pedidos").select("id, total")
        .eq("id", pedidoAnterior).eq("estado", "pendiente").maybeSingle();
      if (data && Number(data.total) === totales.total) pedidoId = data.id;
    }
    if (!pedidoId) pedidoId = await crearPedidoPendiente(request, { items, comprador, carritoId, totales });
    if (!pedidoId) {
      return Response.json({ error: "No pudimos registrar tu pedido. Intentá de nuevo en un momento." }, { status: 500 });
    }

    const [nombre, ...apellido] = String(comprador.nombre ?? "").trim().split(/\s+/);
    const direccion = {
      zip_code:      String(comprador.codigoPostal ?? ""),
      street_name:   String(comprador.calle ?? ""),
      street_number: String(comprador.numero ?? ""),
    };

    const client = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN });
    const resultado = await new Payment(client).create({
      body: {
        transaction_amount: totales.total,
        token:              pago.token,
        installments:       Number(pago.installments) || 1,
        payment_method_id:  pago.payment_method_id,
        ...(pago.issuer_id ? { issuer_id: Number(pago.issuer_id) } : {}),
        payer: {
          email: comprador.email,
          first_name: nombre ?? "",
          last_name:  apellido.join(" "),
          ...(pago.payer?.identification?.number ? { identification: pago.payer.identification } : {}),
        },
        description:          "Compra en Camisetas Zeus",
        statement_descriptor: "CAMISETAS ZEUS",
        external_reference:   pedidoId,
        notification_url:     `${baseUrl}/api/webhook`,
        // Datos extra que ayudan a que Mercado Pago apruebe el pago
        additional_info: {
          items: itemsParaMP(items, totales).map(({ currency_id, ...i }) => ({ ...i, category_id: "fashion" })),
          payer: {
            first_name: nombre ?? "",
            last_name:  apellido.join(" "),
            phone:      { area_code: String(comprador.codigoArea ?? ""), number: String(comprador.celular ?? "") },
            address:    direccion,
          },
          shipments: {
            receiver_address: {
              ...direccion,
              state_name: String(comprador.provincia ?? ""),
              city_name:  String(comprador.localidad ?? ""),
              floor:      String(comprador.piso ?? ""),
              apartment:  String(comprador.departamento ?? ""),
            },
          },
        },
      },
      requestOptions: {
        idempotencyKey: randomUUID(),
        ...(deviceId ? { meliSessionId: String(deviceId) } : {}),
      },
    });

    console.log(`[pago tarjeta] Pedido ${pedidoId}: ${resultado.status} (${resultado.status_detail})`);
    return Response.json({
      pedidoId,
      paymentId: resultado.id,
      status:    resultado.status,
      mensaje:   resultado.status === "rejected" ? (RECHAZOS[resultado.status_detail] ?? RECHAZO_GENERICO) : null,
    });
  } catch (err) {
    // Errores de Mercado Pago antes de llegar a la tarjeta (datos inválidos, token vencido, etc.)
    console.error("[pago tarjeta] Error:", err?.message ?? err, JSON.stringify(err?.cause ?? err?.errors ?? ""));
    return Response.json({ pedidoId, error: "No pudimos procesar el pago. Revisá los datos de la tarjeta e intentá de nuevo." }, { status: 500 });
  }
}
