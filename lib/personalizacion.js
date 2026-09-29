// Personalización (parche estampado) de las camisetas por encargo.
//
// Los pedidos nuevos la guardan en cada item: item.personalizacion = { nombre, numero }.
// Los pedidos anteriores solo la tienen como texto dentro de observaciones:
//   "[PARCHES ESTAMPADOS → TOULOUSE TITULAR T.M: GARCÍA 10 | OTRA T.L: ...] ..."

// { nombre: "García", numero: "10" } → "García #10"
export function textoPersonalizacion({ nombre = "", numero = "" } = {}) {
  return [nombre.trim(), numero.trim() && `#${numero.trim()}`].filter(Boolean).join(" ");
}

// Devuelve { nombre, numero, texto } o null si la camiseta no lleva parche.
// En pedidos viejos solo se conoce el texto libre (nombre y numero vacíos).
export function personalizacionDe(pedido, item) {
  const p = item?.personalizacion;
  if (p && (p.nombre || p.numero)) {
    return { nombre: p.nombre ?? "", numero: p.numero ?? "", texto: textoPersonalizacion(p) };
  }

  const bloque = (pedido?.observaciones ?? "").match(/\[PARCHES ESTAMPADOS → (.*?)\]/);
  if (!bloque) return null;
  const clave = `${item.nombre} T.${item.talle}`;
  for (const parte of bloque[1].split(" | ")) {
    const i = parte.indexOf(": ");
    if (i !== -1 && parte.slice(0, i) === clave) {
      return { nombre: "", numero: "", texto: parte.slice(i + 2).trim() };
    }
  }
  return null;
}
