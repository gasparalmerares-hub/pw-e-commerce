// Mail de recordatorio a carritos abandonados (ver lib/recordatorioCarrito.js).
// Lo llama el cron de vercel.json una vez por día. Si CRON_SECRET está
// configurado en Vercel, exige el header que Vercel manda en sus crons. Si
// alguien más lo llama no pasa nada: cada persona recibe un solo mail.

import { enviarRecordatorios } from "@/lib/recordatorioCarrito";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  try {
    const resultado = await enviarRecordatorios();
    console.log("[cron carritos]", JSON.stringify(resultado));
    return Response.json(resultado);
  } catch (err) {
    console.error("[cron carritos] Error:", err?.message ?? err);
    return Response.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
