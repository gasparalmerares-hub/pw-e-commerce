// Mail automático de recordatorio para carritos abandonados (Resend).
//
// Lo dispara una vez por día el cron de vercel.json (/api/cron/carritos).
// Le llega a quien dejó su mail en Finalizar compra o fue a Mercado Pago y no
// pagó, entre 2 y 48 horas después, una sola vez por persona. No se manda a
// quien eligió transferencia (eso se sigue por WhatsApp), a quien ya compró,
// a quien ya marcaste "Contactado" en Admin → Carritos, ni a quien tiene un
// pago de Mercado Pago en curso. Los mails enviados se guardan en
// configuracion.carritos_mail_enviado ({ email: fecha }).

import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { carritosAbandonados, itemsVigentes, leerConfigJSON, guardarConfigJSON, CLAVE_MAILS } from "@/lib/carritosServidor";
import { pagosDePedido, PAGO_EN_CURSO } from "@/lib/mpPagos";

const DESDE_HORAS = 2;
const HASTA_HORAS = 48;
const MAXIMO      = 20;
const EMAIL_RE    = /^\S+@\S+\.\S+$/;
const WHATSAPP    = "5492216220145";

const base = () => (process.env.NEXT_PUBLIC_URL ?? "https://camisetaszeus.com")
  .replace("://www.", "://")
  .replace(/\/$/, "");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "IRLANDA 2024 LOCAL" → "Irlanda 2024 Local"
const titulo = (s) => String(s ?? "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());

const primerNombre = (nombre) => titulo(String(nombre ?? "").trim().split(/\s+/)[0] ?? "");

const pesos = (n) => "$" + Number(n || 0).toLocaleString("es-AR");

export function enlaceRecuperar(id) {
  return `${base()}/carrito?recuperar=${id}&utm_source=mail&utm_medium=email&utm_campaign=carrito_abandonado`;
}

export function asuntoRecordatorio(nombre) {
  const n = primerNombre(nombre);
  return n ? `${n}, te guardamos tu carrito 🏉` : "Te guardamos tu carrito 🏉";
}

export function htmlRecordatorio({ nombre, items, id }) {
  const n = primerNombre(nombre);
  const descuento = Math.max(0, ...items.map((i) => Number(i.descuentoTransferencia) || 0));
  const filas = items.map((i) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eeeeee">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          ${i.imagen ? `<td width="64" style="padding-right:12px;vertical-align:middle"><img src="${esc(i.imagen)}" width="64" height="64" alt="" style="display:block;border-radius:8px;background:#f5f5f0;object-fit:contain" /></td>` : ""}
          <td style="vertical-align:middle">
            <p style="margin:0;font-size:15px;font-weight:bold;color:#111827">${esc(titulo(i.nombre))}</p>
            <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Talle ${esc(i.talle)}${i.cantidad > 1 ? ` · x${i.cantidad}` : ""}</p>
          </td>
          <td align="right" style="vertical-align:middle;white-space:nowrap;font-size:15px;font-weight:bold;color:#f97316">${pesos(i.precio * i.cantidad)}</td>
        </tr></table>
      </td>
    </tr>`).join("");
  const whatsapp = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Hola! Tuve un problema para terminar mi compra en la web.")}`;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;color:#111827;border-radius:12px;overflow:hidden;border:1px solid #eaeaea">
      <div style="background:#111827;padding:24px;text-align:center">
        <img src="${base()}/logo.png" height="44" alt="Camisetas Zeus" />
      </div>
      <div style="padding:28px 24px">
        <h1 style="color:#f97316;font-size:22px;margin:0 0 12px">¿Te quedó algo pendiente? 🏉</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
          ¡Hola${n ? " " + esc(n) : ""}! Vimos que empezaste una compra en Camisetas Zeus y no llegaste a terminarla. Te guardamos lo que elegiste:
        </p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">${filas}</table>
        ${descuento > 0 ? `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;margin-top:18px">
          <p style="margin:0;font-size:14px;line-height:1.6;color:#166534">💸 Pagando por <strong>transferencia</strong> tenés <strong>${descuento}% de descuento</strong>.</p>
        </div>` : ""}
        <div style="text-align:center;margin:26px 0 22px">
          <a href="${enlaceRecuperar(id)}" style="display:inline-block;background:#f97316;color:#000000;font-weight:bold;font-size:16px;text-decoration:none;padding:14px 32px;border-radius:10px">Terminar mi compra</a>
        </div>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151">
          ¿Tuviste algún problema para pagar o te quedó alguna duda? <a href="${whatsapp}" style="color:#16a34a;font-weight:bold;text-decoration:none">Escribinos por WhatsApp</a> y te ayudamos.
        </p>
        <p style="margin:0 0 20px;font-size:15px;font-weight:bold;color:#f97316">¡Abrazo! Gaspar, de Camisetas Zeus</p>
        <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af">
          Te escribimos una sola vez por esta compra. Si ya no te interesa, ignorá este mail.
        </p>
      </div>
    </div>
  `;
}

// A quiénes les toca el mail hoy
export async function candidatosRecordatorio(db) {
  const ahora = Date.now();
  return (await carritosAbandonados(db, 3)).filter((c) => {
    const horas = (ahora - new Date(c.fecha)) / 36e5;
    return horas >= DESDE_HORAS && horas <= HASTA_HORAS && c.tipo !== "transferencia"
      && !c.yaCompro && !c.contactado && !c.mailEnviado && EMAIL_RE.test(c.email);
  });
}

export async function enviarRecordatorios() {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Falta RESEND_API_KEY" };

  const db = supabaseAdmin();
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const candidatos = (await candidatosRecordatorio(db)).slice(0, MAXIMO);
  const enviados = await leerConfigJSON(db, CLAVE_MAILS);
  const resultado = { ok: true, candidatos: candidatos.length, enviados: 0, salteados: 0 };

  for (const c of candidatos) {
    const email = c.email.toLowerCase();
    if (enviados[email]) continue;
    // Si el pago de Mercado Pago está en curso (o ya se aprobó) no se le escribe
    if (c.tipo === "mercadopago") {
      const pagos = await pagosDePedido(c.id);
      if (pagos?.some((p) => PAGO_EN_CURSO.includes(p.estado))) { resultado.salteados++; continue; }
    }
    // Sin productos disponibles (se borraron o no hay stock del talle) no tiene sentido
    const items = await itemsVigentes(db, c.items);
    if (!items.length) { resultado.salteados++; continue; }

    const { error } = await resend.emails.send({
      from,
      to: c.email,
      subject: asuntoRecordatorio(c.nombre),
      html: htmlRecordatorio({ nombre: c.nombre, items, id: c.id }),
    });
    if (error) {
      console.error("[recordatorio] Resend retornó error:", JSON.stringify(error));
      continue;
    }
    // Se guarda después de cada envío: si el cron se corta, nadie recibe dos mails
    enviados[email] = new Date().toISOString();
    await guardarConfigJSON(db, CLAVE_MAILS, enviados);
    resultado.enviados++;
    console.log("[recordatorio] Enviado a", c.email);
    await new Promise((r) => setTimeout(r, 600)); // límite de Resend: pocos mails por segundo
  }
  return resultado;
}
