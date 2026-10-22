// Precio de envío según la provincia del comprador.
//
// En la tabla `configuracion` se guardan:
//   - precio_envio: precio general (se usa para las provincias sin precio propio)
//   - precio_envio_provincias: JSON { "Córdoba": 12000, ... } cargado desde el admin
// Lo usan el checkout (para mostrar el total) y las API de pedidos (para cobrar),
// así el precio que ve el comprador y el que se cobra siempre coinciden.

export const PROVINCIAS = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

export function parsePreciosProvincias(valor) {
  try {
    const obj = typeof valor === "string" ? JSON.parse(valor) : valor;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

// config: objeto { clave: valor } tal como sale de la tabla configuracion
export function precioEnvioPara(config, provincia) {
  const general   = parseInt(config?.precio_envio) || 0;
  const porProv   = parsePreciosProvincias(config?.precio_envio_provincias);
  const especial  = parseInt(porProv[provincia]);
  return Number.isFinite(especial) && especial > 0 ? especial : general;
}

// Lo más barato que puede costar el envío (para avisarlo antes del checkout).
// Devuelve { precio, varia }: varia = true si alguna provincia tiene otro precio.
export function envioDesde(config) {
  const general = parseInt(config?.precio_envio) || 0;
  const precios = [general, ...Object.values(parsePreciosProvincias(config?.precio_envio_provincias))
    .map((v) => parseInt(v)).filter((v) => Number.isFinite(v) && v > 0)].filter((v) => v > 0);
  if (!precios.length) return { precio: 0, varia: false };
  return { precio: Math.min(...precios), varia: new Set(precios).size > 1 };
}
