import { unstable_noStore as noStore } from "next/cache";
import { validarCodigo } from "@/lib/codigosServidor";

export const dynamic = "force-dynamic";

// "Aplicar" del código de descuento en Finalizar compra: { codigo } →
// { codigo, porcentaje } o { error }. Igual se vuelve a validar al crear el pedido.
export async function POST(request) {
  noStore();
  try {
    const { codigo } = await request.json();
    const r = await validarCodigo(codigo);
    return Response.json(r, { status: r.error ? 400 : 200, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[codigos] Error:", err?.message);
    return Response.json({ error: "No se pudo revisar el código. Probá de nuevo." }, { status: 500 });
  }
}
