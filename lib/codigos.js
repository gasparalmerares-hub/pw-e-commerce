// Códigos de descuento (se crean en Admin → Configuración). Son un porcentaje
// sobre el precio de cada producto; el envío y los parches no llevan
// descuento. Se SUMAN con el descuento por transferencia: pagando por
// transferencia, el código se aplica sobre el precio con transferencia.
// Lo usan el checkout (para mostrar el total) y las API de pedidos (para
// cobrar), así lo que ve el comprador y lo que se cobra coinciden.

// Solo letras y números, en mayúsculas ("zeus 10" → "ZEUS10")
export const normalizarCodigo = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);

export const conCodigo = (precio, porcentaje) =>
  porcentaje > 0 ? Math.round(Number(precio) * (1 - porcentaje / 100)) : Number(precio);

// Marca que queda en observaciones del pedido; con ella se cuentan los usos
export const marcaCodigo = ({ codigo, porcentaje }) => `[CODIGO ${codigo} -${porcentaje}%]`;
