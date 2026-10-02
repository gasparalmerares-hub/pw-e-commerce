import { MAX_CUOTAS } from "@/lib/cuotas";

// Cuotas con tarjeta de crédito para un monto, con las tasas reales de la
// cuenta de Mercado Pago de la tienda. El interés depende de la tarjeta y del
// banco, así que se consultan Visa y Mastercard y, para cada cantidad de
// cuotas, se informa el rango (desde / hasta) y el CFT de la opción más barata.
//
// GET /api/cuotas?monto=77700
// → { opciones: [{ cuotas, desde, hasta, totalDesde, cft, sinInteres }] }

const MEDIOS = ["visa", "master"];

// Las tasas cambian poco: se cachea 1 hora por monto (hay pocos precios distintos)
const CACHE = { "Cache-Control": "public, s-maxage=3600, max-age=600, stale-while-revalidate=86400" };

function cftDe(labels) {
  const m = (labels ?? []).join("|").match(/CFT_([\d.,]+)%/);
  return m ? m[1] : null;
}

export async function GET(request) {
  const monto = parseInt(new URL(request.url).searchParams.get("monto"));
  if (!Number.isFinite(monto) || monto <= 0 || monto > 10_000_000) {
    return Response.json({ error: "Monto inválido" }, { status: 400 });
  }
  if (!process.env.MP_ACCESS_TOKEN) {
    return Response.json({ opciones: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const respuestas = await Promise.all(MEDIOS.map(async (medio) => {
      const res = await fetch(
        `https://api.mercadopago.com/v1/payment_methods/installments?amount=${monto}&payment_method_id=${medio}`,
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }, cache: "no-store" }
      );
      if (!res.ok) throw new Error(`Mercado Pago respondió ${res.status} (${medio})`);
      return res.json();
    }));

    // Todas las opciones de todas las tarjetas/bancos, agrupadas por cantidad de cuotas
    const porCuotas = new Map();
    for (const lista of respuestas) {
      for (const emisor of Array.isArray(lista) ? lista : []) {
        for (const c of emisor.payer_costs ?? []) {
          if (!c.installments || c.installments > MAX_CUOTAS) continue;
          if (!porCuotas.has(c.installments)) porCuotas.set(c.installments, []);
          porCuotas.get(c.installments).push(c);
        }
      }
    }

    const opciones = [...porCuotas.entries()]
      .sort(([a], [b]) => a - b)
      .map(([cuotas, lista]) => {
        const masBarata = lista.reduce((min, c) => (c.total_amount < min.total_amount ? c : min));
        const hasta = Math.max(...lista.map((c) => c.installment_amount));
        return {
          cuotas,
          desde:      Math.round(masBarata.installment_amount),
          hasta:      Math.round(hasta),
          totalDesde: Math.round(masBarata.total_amount),
          cft:        cftDe(masBarata.labels),
          sinInteres: masBarata.total_amount <= monto + 1,
        };
      });

    return Response.json({ opciones }, { headers: CACHE });
  } catch (err) {
    console.error("[cuotas] Error consultando Mercado Pago:", err.message);
    return Response.json({ opciones: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
