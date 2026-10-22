import { unstable_noStore as noStore } from "next/cache";
import { enviarGA } from "@/lib/gaServer";
import { GA_ID } from "@/lib/ga";

export const dynamic = "force-dynamic";

// Diagnóstico de las compras de Google Analytics desde el servidor (solo
// admin, ver middleware). Manda un evento "prueba_servidor" (no es una
// compra): si el código secreto funciona, aparece en GA → Informes →
// Tiempo real a los pocos segundos. Nunca muestra el código secreto.
export async function GET() {
  noStore();
  const resultado = { medicion: GA_ID, secretoConfigurado: !!process.env.GA_API_SECRET, envio: null };
  if (!resultado.secretoConfigurado) {
    resultado.envio = "Falta GA_API_SECRET en Vercel.";
    return Response.json(resultado);
  }
  try {
    const r = await enviarGA({ name: "prueba_servidor", params: { debug_mode: 1 } });
    resultado.envio = r.ok ? "enviado: buscalo en GA → Informes → Tiempo real" : `GA respondió ${r.status}`;
  } catch (err) {
    resultado.envio = err.message;
  }
  return Response.json(resultado);
}
