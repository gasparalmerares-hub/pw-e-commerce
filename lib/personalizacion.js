// Personalización (parche estampado) de las camisetas por encargo.
//
// Se guarda por unidad: item.personalizaciones = [{ nombre, numero } | null, ...],
// una posición por cada camiseta del item (cantidad). Formatos anteriores:
//   - item.personalizacion = { nombre, numero }  (un solo parche por item)
//   - solo texto dentro de observaciones:
//     "[PARCHES ESTAMPADOS → TOULOUSE TITULAR T.M: GARCÍA 10 | OTRA T.L: ...] ..."

// { nombre: "García", numero: "10" } → "García #10"
export function textoPersonalizacion({ nombre = "", numero = "" } = {}) {
  return [nombre.trim(), numero.trim() && `#${numero.trim()}`].filter(Boolean).join(" ");
}

function normalizar(p) {
  return p && (p.nombre || p.numero)
    ? { nombre: p.nombre ?? "", numero: p.numero ?? "", texto: textoPersonalizacion(p) }
    : null;
}

// Devuelve un array con la personalización de cada unidad del item
// ({ nombre, numero, texto } o null si esa camiseta no lleva parche).
// En pedidos viejos solo se conoce el texto libre (nombre y numero vacíos).
export function personalizacionesDe(pedido, item) {
  const cantidad = Number(item?.cantidad) || 1;
  const vacias   = Array(cantidad).fill(null);

  if (Array.isArray(item?.personalizaciones)) {
    return vacias.map((_, u) => normalizar(item.personalizaciones[u]));
  }
  if (normalizar(item?.personalizacion)) {
    return [normalizar(item.personalizacion), ...vacias.slice(1)];
  }

  const bloque = (pedido?.observaciones ?? "").match(/\[PARCHES ESTAMPADOS → (.*?)\]/);
  if (!bloque) return vacias;
  const clave  = `${item.nombre} T.${item.talle}`;
  const textos = bloque[1].split(" | ")
    .filter((parte) => parte.slice(0, parte.indexOf(": ")) === clave)
    .map((parte) => parte.slice(parte.indexOf(": ") + 2).trim());
  return vacias.map((_, u) => (textos[u] ? { nombre: "", numero: "", texto: textos[u] } : null));
}
