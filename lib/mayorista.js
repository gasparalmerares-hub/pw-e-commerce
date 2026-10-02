// Venta mayorista de camisetas en stock: precio por unidad en dólares según la
// cantidad total del pedido (todas las camisetas suman, sin importar modelo o
// talle). Lo usan la página /mayorista y la API que registra el pedido, así el
// precio que ve el cliente y el que se le informa a la tienda coinciden.

export const MINIMO_MAYORISTA = 10;

// De mayor a menor: se aplica la primera escala cuyo "desde" se alcanza
export const ESCALAS_MAYORISTA = [
  { desde: 30, precio: 28 },
  { desde: 20, precio: 30 },
  { desde: 15, precio: 31 },
  { desde: 10, precio: 32 },
];

// Precio por camiseta en USD para una cantidad total (null si no llega al mínimo)
export function precioMayoristaUSD(cantidad) {
  return ESCALAS_MAYORISTA.find((e) => cantidad >= e.desde)?.precio ?? null;
}

// Próxima escala con mejor precio: { faltan, precio } o null si ya está en la mejor
export function siguienteEscala(cantidad) {
  const siguiente = [...ESCALAS_MAYORISTA].reverse().find((e) => e.desde > cantidad);
  return siguiente ? { faltan: siguiente.desde - cantidad, precio: siguiente.precio } : null;
}
