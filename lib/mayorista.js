// Venta mayorista. Dos modalidades, ambas con mínimo de 10 camisetas y precio
// por unidad en dólares según la cantidad total del pedido (todas suman, sin
// importar modelo o talle):
//   - stock:   camisetas en stock, se paga el 100% al comprar.
//   - encargo: "pedido a medida" del catálogo, se fabrica en una carga
//              consolidada; seña del 60% y saldo a la entrega. La
//              personalización suma USD 1 por nombre y USD 1 por número.
// Lo usan la página /mayorista y la API que registra el pedido, así el precio
// que ve el cliente y el que se le informa a la tienda coinciden.

export const MINIMO_MAYORISTA = 10;

// De mayor a menor: se aplica la primera escala cuyo "desde" se alcanza
export const ESCALAS_STOCK = [
  { desde: 30, precio: 28 },
  { desde: 20, precio: 30 },
  { desde: 15, precio: 31 },
  { desde: 10, precio: 32 },
];

export const ESCALAS_ENCARGO = [
  { desde: 30, precio: 24, nombre: "Mayorista Pro" },
  { desde: 20, precio: 27, nombre: "Mayorista +" },
  { desde: 10, precio: 30, nombre: "Mayorista" },
];

export const PRECIO_PERSONALIZACION_USD = 1; // por nombre y por número
export const SENA_ENCARGO            = 0.6;  // 60% para confirmar el encargo
export const CARGA_ENCARGO           = 100;  // camisetas por carga a fábrica
export const PRECIO_SUGERIDO_REVENTA = 70000;

// Precio por camiseta en USD para una cantidad total (null si no llega al mínimo)
export function precioPorEscala(escalas, cantidad) {
  return escalas.find((e) => cantidad >= e.desde) ?? null;
}

// Próxima escala con mejor precio: { faltan, precio, nombre } o null si ya está en la mejor
export function siguienteEscala(escalas, cantidad) {
  const siguiente = [...escalas].reverse().find((e) => e.desde > cantidad);
  return siguiente ? { ...siguiente, faltan: siguiente.desde - cantidad } : null;
}

// Cantidad de agregados de personalización (nombre y número cuentan aparte)
export function cantidadPersonalizaciones(personalizaciones) {
  return (personalizaciones ?? []).reduce(
    (s, p) => s + (p?.nombre?.trim() ? 1 : 0) + (p?.numero?.trim() ? 1 : 0), 0
  );
}

export function redondearUSD(n) {
  return Math.round(n * 100) / 100;
}

// "USD 180" o "USD 180,60"
export function formatoUSD(n) {
  const r = redondearUSD(n);
  return "USD " + r.toLocaleString("es-AR", Number.isInteger(r) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Camisetas que esperan la próxima carga a fábrica: las de pedidos a medida
// mayoristas con la seña pagada (estado "pagado") que todavía no se encargaron.
// Al marcarlas como "encargadas" en /admin/encargos salen del conteo y la carga
// vuelve a empezar. A esto se le suma el ajuste manual de la tienda
// (configuracion.carga_ajuste), por ejemplo camisetas propias para completarla.
export function camisetasEnCarga(pedidos) {
  return (pedidos ?? [])
    .filter((p) => p.estado === "pagado" && (p.observaciones ?? "").includes("[ENCARGO]"))
    .flatMap((p) => p.items ?? [])
    .filter((i) => i.tabla === "productos_catalogo" && !i.encargo)
    .reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
}
