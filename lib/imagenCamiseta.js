// Arma en el navegador (canvas) una imagen con la foto de una camiseta y, abajo,
// líneas de texto en grande (talle, nombre, número, cantidad...). Es el formato
// de foto que se manda por WhatsApp: al proveedor desde /admin/encargos y a la
// tienda desde los pedidos de /mayorista.

async function cargarImagen(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("No se pudo cargar la foto");
  return createImageBitmap(await res.blob());
}

// Achica la fuente hasta que el texto entre en el ancho disponible
function fuenteQueEntra(ctx, texto, anchoMax, tamanoMax) {
  let t = tamanoMax;
  ctx.font = `bold ${t}px Arial, Helvetica, sans-serif`;
  while (ctx.measureText(texto).width > anchoMax && t > 24) {
    t -= 4;
    ctx.font = `bold ${t}px Arial, Helvetica, sans-serif`;
  }
}

// → File JPG de 1080x1350 listo para compartir o descargar
export async function armarImagenCamiseta({ imagen, lineas, nombreArchivo }) {
  const W = 1080, H = 1350, FOTO = 960, BASE_TEXTO = 1030;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  try {
    const img = await cargarImagen(imagen);
    const escala = Math.min(FOTO / img.width, FOTO / img.height);
    const w = img.width * escala, h = img.height * escala;
    ctx.drawImage(img, (W - w) / 2, 40 + (FOTO - h) / 2, w, h);
  } catch {
    ctx.fillStyle = "#999999";
    ctx.font = "bold 48px Arial, Helvetica, sans-serif";
    ctx.fillText("(sin foto)", W / 2, 520);
  }

  ctx.fillStyle = "#111111";
  ctx.fillRect(60, BASE_TEXTO - 16, W - 120, 4);

  const alto = (H - BASE_TEXTO - 20) / lineas.length;
  lineas.forEach((linea, i) => {
    fuenteQueEntra(ctx, linea, W - 120, Math.min(130, alto * 0.8));
    ctx.fillText(linea, W / 2, BASE_TEXTO + alto * (i + 1) - alto * 0.2);
  });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return new File([blob], nombreArchivo, { type: "image/jpeg" });
}

// Compartir (celular) o descargar (compu) una lista de imágenes ya armadas.
// compartir() tiene que llamarse desde un toque del usuario.
export function puedeCompartirArchivos(files) {
  return typeof navigator !== "undefined" && files.length > 0 && !!navigator.canShare?.({ files });
}

export async function compartirArchivos(files) {
  try {
    await navigator.share({ files });
  } catch (err) {
    if (err?.name !== "AbortError") throw err;
  }
}

export async function descargarArchivos(files) {
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    await new Promise((r) => setTimeout(r, 300));
    URL.revokeObjectURL(url);
  }
}
