// Datos del navegador del comprador que Meta necesita para atribuir una compra
// a un anuncio: las cookies del pixel (_fbp, _fbc), el navegador y la IP. Se
// capturan cuando se crea el pedido (la compra se confirma después, en el
// webhook de Mercado Pago o al marcar el pedido como pagado en el panel, y
// ahí ya no hay navegador) y se envían con el Purchase de la Conversions API.
//
// La tabla pedidos no tiene una columna para esto, así que viaja al final de
// observaciones como "[META:<json en base64url>]". La API del panel lo quita
// antes de mostrar los pedidos (panel y Excel no lo ven).

const RE_META = /\s*\[META:([A-Za-z0-9_-]+)\]/;

function leerCookie(header, nombre) {
  const m = (header ?? "").match(new RegExp(`(?:^|;\\s*)${nombre}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

// Desde la request del checkout (mismo dominio, así que llegan las cookies del pixel)
export function atribucionDesdeRequest(request) {
  const cookie = request.headers.get("cookie");
  const attr = {
    fbp: leerCookie(cookie, "_fbp"),
    fbc: leerCookie(cookie, "_fbc"),
    ua:  request.headers.get("user-agent"),
    ip:  (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip"),
  };
  for (const k of Object.keys(attr)) if (!attr[k]) delete attr[k];
  return Object.keys(attr).length ? attr : null;
}

export function conAtribucion(observaciones, attr) {
  const base = sinAtribucion(observaciones);
  if (!attr) return base;
  const codificado = Buffer.from(JSON.stringify(attr)).toString("base64url");
  return `${base} [META:${codificado}]`.trim();
}

export function leerAtribucion(observaciones) {
  const m = (observaciones ?? "").match(RE_META);
  if (!m) return null;
  try {
    return JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function sinAtribucion(observaciones) {
  return (observaciones ?? "").replace(RE_META, "").trim();
}
