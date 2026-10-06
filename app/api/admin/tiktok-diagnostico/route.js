import { unstable_noStore as noStore } from "next/cache";
import { TT_PIXEL_ID } from "@/lib/ttpixel";

export const dynamic = "force-dynamic";

// Diagnóstico de la Events API de TikTok (solo admin, ver middleware), la
// contraparte de /api/admin/meta-diagnostico. Con ?test_event_code=XXXX (el
// código de Events Manager → píxel → "Probar eventos") manda un evento de
// prueba: si llega, el token funciona. Los eventos de prueba no cuentan como
// ventas reales. Nunca muestra el token.
export async function GET(request) {
  noStore();
  const TOKEN = process.env.TIKTOK_EVENTS_TOKEN;
  const testCode = new URL(request.url).searchParams.get("test_event_code");
  const resultado = { pixel: TT_PIXEL_ID, tokenConfigurado: !!TOKEN, eventoDePrueba: null, detalle: null };

  if (!TOKEN) {
    resultado.detalle = "Falta TIKTOK_EVENTS_TOKEN en Vercel.";
    return Response.json(resultado);
  }
  if (!testCode) {
    resultado.detalle = "Token cargado. Para probarlo, agregá ?test_event_code=CODIGO (Events Manager → Probar eventos).";
    return Response.json(resultado);
  }
  try {
    const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Access-Token": TOKEN },
      body: JSON.stringify({
        event_source: "web",
        event_source_id: TT_PIXEL_ID,
        test_event_code: testCode,
        data: [{ event: "CompletePayment", event_time: Math.floor(Date.now() / 1000), event_id: `prueba-${Date.now()}`,
          properties: { currency: "ARS", value: 1, content_type: "product" } }],
      }),
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    resultado.eventoDePrueba = res.ok && json?.code === 0 ? "enviado" : "error";
    resultado.detalle = json?.message ?? `TikTok respondió ${res.status}`;
  } catch (err) {
    resultado.eventoDePrueba = "error";
    resultado.detalle = err.message;
  }
  return Response.json(resultado);
}
