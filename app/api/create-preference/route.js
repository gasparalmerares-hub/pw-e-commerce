import MercadoPago, { Preference } from "mercadopago";
import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

async function getPrecioConfig(clave) {
  try {
    const { data } = await supabaseAdmin()
      .from("configuracion")
      .select("valor")
      .eq("clave", clave)
      .single();
    return data ? parseInt(data.valor) || 0 : 0;
  } catch {
    return 0;
  }
}

export async function POST(request) {
  noStore();
  if (!process.env.MP_ACCESS_TOKEN) {
    return Response.json(
      { error: "El servicio de pagos aún no está configurado. Contactanos por WhatsApp." },
      { status: 503 }
    );
  }

  try {
    const { items, comprador, parches } = await request.json();
    const parchesArr = Array.isArray(parches) ? parches : [];

    // MercadoPago NO sigue redirects en el webhook: si el notification_url
    // apunta a un dominio que redirige (www ↔ sin www, según cómo esté
    // configurado el dominio en Vercel), el pago nunca se registra.
    // Usamos el host por el que entró esta request, que es justamente el que
    // responde 200. NEXT_PUBLIC_URL queda solo como respaldo (desarrollo local).
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    const baseUrl = host && !host.startsWith("localhost")
      ? `https://${host}`
      : (process.env.NEXT_PUBLIC_URL ?? "").replace(/\/$/, "");

    const precioEnvio = await getPrecioConfig("precio_envio");
    const precioEstampaUnit = parchesArr.length ? await getPrecioConfig("precio_estampa") : 0;
    const costoEstampa = parchesArr.length * precioEstampaUnit;
    const total = items.reduce((sum, i) => sum + Number(i.precio) * Number(i.cantidad), 0) + precioEnvio + costoEstampa;
    const parchesTxt = parchesArr.map((p) => `${p.nombre} T.${p.talle}: ${p.detalle}`).join(" | ");

    // Guardar pedido en Supabase antes de redirigir a MP
    let pedidoId = null;
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
          observaciones: `${parchesArr.length ? `[PARCHES ESTAMPADOS → ${parchesTxt}] ` : ""}${comprador.observaciones ?? ""}`.trim(),
          items,
          total,
          estado: "pendiente",
        })
        .select("id")
        .single();
      pedidoId = data?.id ?? null;
    } catch (e) {
      console.error("Error saving pedido (no bloqueante):", e);
    }

    const client = new MercadoPago({ accessToken: process.env.MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
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
            unit_price: Number(precioEnvio),
            currency_id: "ARS",
          },
          ...(parchesArr.length > 0 ? [{
            id: "estampa",
            title: `Parche estampado (x${parchesArr.length})`,
            quantity: parchesArr.length,
            unit_price: Number(precioEstampaUnit),
            currency_id: "ARS",
          }] : []),
        ],
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
          installments: 1,
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
