import { supabaseAdmin } from "@/lib/supabase";
import { unstable_noStore as noStore } from "next/cache";
import { precioEnvioPara } from "@/lib/envio";
import { atribucionDesdeRequest, conAtribucion } from "@/lib/metaAtribucion";

export const dynamic = "force-dynamic";

export async function POST(request) {
  noStore();
  try {
    const { items, comprador, parches } = await request.json();
    const parchesArr = Array.isArray(parches) ? parches : [];

    // El envío y la estampa se calculan acá con los valores de configuración
    // (no se confía en lo que manda el navegador), igual que en el checkout.
    const { data: configRows } = await supabaseAdmin()
      .from("configuracion")
      .select("clave, valor")
      .in("clave", ["precio_envio", "precio_envio_provincias", "precio_estampa"]);
    const config = Object.fromEntries((configRows ?? []).map(({ clave, valor }) => [clave, valor]));
    const precioEnvio   = precioEnvioPara(config, comprador?.provincia);
    const precioEstampa = parseInt(config.precio_estampa) || 0;

    // Usar precio con descuento por transferencia si vino, sino el regular
    const subtotal     = items.reduce((sum, i) => sum + Number(i.precioTransf ?? i.precio) * Number(i.cantidad), 0);
    const costoEstampa = parchesArr.length * precioEstampa;
    const total        = subtotal + (parseInt(precioEnvio) || 0) + costoEstampa;
    const parchesTxt   = parchesArr.map((p) => `${p.nombre} T.${p.talle}: ${p.detalle}`).join(" | ");

    const fila = {
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
        `[TRANSFERENCIA]${parchesArr.length ? ` [PARCHES ESTAMPADOS → ${parchesTxt}]` : ""} ${comprador.observaciones ?? ""}`.trim(),
        atribucionDesdeRequest(request)
      ),
      items,
      total,
      estado:        "pendiente_transferencia",
    };

    let { data, error } = await supabaseAdmin()
      .from("pedidos")
      .insert(fila)
      .select("id")
      .single();

    // Si la columna 'estado' tiene un CHECK constraint que rechaza
    // 'pendiente_transferencia', usamos 'pendiente' como fallback.
    // El admin lo distingue por el prefijo [TRANSFERENCIA] en observaciones.
    if (error) {
      console.error("[transferencia] Insert con pendiente_transferencia falló:", error.message);
      const fallback = { ...fila, estado: "pendiente" };
      const retry = await supabaseAdmin()
        .from("pedidos")
        .insert(fallback)
        .select("id")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("[transferencia] Insert también falló con fallback:", error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }

    console.log("[transferencia] Pedido creado:", data.id);
    return Response.json({ id: data.id });
  } catch (err) {
    console.error("[transferencia] Excepción:", err);
    return Response.json({ error: err.message ?? "Error al registrar el pedido" }, { status: 500 });
  }
}
