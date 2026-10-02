import { getDolarBlue } from "@/lib/dolar";

// Dólar blue para el cotizador de /mayorista
export async function GET() {
  try {
    const dolar = await getDolarBlue();
    return Response.json(dolar, {
      headers: { "Cache-Control": "public, s-maxage=3600, max-age=600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    console.error("[dolar-blue] Error:", err.message);
    return Response.json({ error: "No se pudo obtener la cotización" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
