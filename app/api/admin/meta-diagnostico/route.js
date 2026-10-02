import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";

// Diagnóstico de la Conversions API de Meta (solo admin, ver middleware):
// confirma que estén cargadas las variables y que el token sea válido para el
// pixel, sin mostrar el token. Si el token falta o venció, las compras pagadas
// por transferencia (y las de Mercado Pago sin volver a la web) no llegan a Meta.
export async function GET() {
  noStore();
  const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const TOKEN    = process.env.META_CONVERSIONS_TOKEN;
  const resultado = { pixelConfigurado: !!PIXEL_ID, tokenConfigurado: !!TOKEN, tokenValido: false, detalle: null };

  if (!PIXEL_ID || !TOKEN) {
    resultado.detalle = "Falta META_CONVERSIONS_TOKEN o NEXT_PUBLIC_META_PIXEL_ID en Vercel.";
    return Response.json(resultado);
  }
  try {
    const res  = await fetch(`https://graph.facebook.com/v21.0/${PIXEL_ID}?fields=id,name&access_token=${TOKEN}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok && data.id) {
      resultado.tokenValido = true;
      resultado.detalle = `Token OK para el pixel "${data.name}"`;
    } else {
      resultado.detalle = data?.error?.message ?? `Meta respondió ${res.status}`;
    }
  } catch (err) {
    resultado.detalle = err.message;
  }
  return Response.json(resultado);
}
