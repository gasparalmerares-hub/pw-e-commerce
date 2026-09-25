import { createClient } from "@supabase/supabase-js";

import fs from "node:fs";
import path from "node:path";

// Nunca hardcodear secretos: este repo es publico.
function env(nombre) {
  if (process.env[nombre]) return process.env[nombre];
  try {
    const ruta = path.join(path.dirname(new URL(import.meta.url).pathname), "..", ".env.local");
    for (const linea of fs.readFileSync(ruta, "utf8").split(String.fromCharCode(10))) {
      if (linea.trim().startsWith(nombre + "=")) return linea.split("=").slice(1).join("=").trim();
    }
  } catch {}
  throw new Error(`Falta ${nombre}. Definila como variable de entorno o en .env.local`);
}

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TALLES_DEFAULT = ["S", "M", "L", "XL", "2XL", "3XL"];
const PRECIO = 75000;

// Mapeo de productos: key (= prefijo del nombre de archivo) → metadatos
const productos = [
  {
    key: "AllBlacks_suplente",
    nombre: "All Blacks Suplente",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta suplente de los All Blacks, con diseño alternativo que mantiene la esencia del equipo más icónico del rugby mundial.",
  },
  {
    key: "AllBlacks_titular",
    nombre: "All Blacks Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de los All Blacks, el negro legendario del equipo más ganador en la historia del rugby internacional.",
  },
  {
    key: "Bath",
    nombre: "Bath",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta del Bath Rugby Club, uno de los clubes más históricos y exitosos del rugby inglés.",
  },
  {
    key: "Blues_suplente",
    nombre: "Blues Suplente",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta suplente de los Blues, la franquicia de Auckland en el Super Rugby Pacific.",
  },
  {
    key: "Blues_titular",
    nombre: "Blues Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular de los Blues, la franquicia de Auckland que domina el Super Rugby con su juego explosivo.",
  },
  {
    key: "BritishIrishLions_25",
    nombre: "British & Irish Lions 2025",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta de los British & Irish Lions para la gira 2025, la selección de élite que se forma cada cuatro años.",
  },
  {
    key: "BritishIrishLions_azul",
    nombre: "British & Irish Lions Azul",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta alternativa azul de los British & Irish Lions, edición especial de gira.",
  },
  {
    key: "BritishIrishLions_blanca",
    nombre: "British & Irish Lions Blanca",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta alternativa blanca de los British & Irish Lions, diseño exclusivo de la gira.",
  },
  {
    key: "BritishIrishLions_entrenamiento",
    nombre: "British & Irish Lions Entrenamiento",
    categoria: "training",
    tipo: "club",
    descripcion:
      "Camiseta de entrenamiento de los British & Irish Lions, diseñada para la preparación de la gira.",
  },
  {
    key: "BritishIrishLions_mangaLarga",
    nombre: "British & Irish Lions Manga Larga",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta de manga larga de los British & Irish Lions, perfecta para condiciones climáticas adversas.",
  },
  {
    key: "BritishIrishLions_musculosa",
    nombre: "British & Irish Lions Musculosa",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Musculosa de los British & Irish Lions, diseño sin mangas para el calor de la gira.",
  },
  {
    key: "BritishIrishLions_verde",
    nombre: "British & Irish Lions Verde",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta alternativa verde de los British & Irish Lions, edición exclusiva de gira por el Pacífico.",
  },
  {
    key: "Chiefs_suplente",
    nombre: "Chiefs Suplente",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta suplente de los Chiefs, la franquicia de Waikato con múltiples títulos en el Super Rugby.",
  },
  {
    key: "Chiefs_titular",
    nombre: "Chiefs Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular de los Chiefs, la franquicia de Waikato con múltiples títulos en el Super Rugby.",
  },
  {
    key: "Chomba_Springboks",
    nombre: "Chomba Springboks",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Chomba oficial de los Springboks, el verde y dorado de los campeones del mundo en corte polo.",
  },
  {
    key: "Chomba_mangaLarga_Springboks",
    nombre: "Chomba Manga Larga Springboks",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Chomba de manga larga de los Springboks, el clásico polo del rugby sudafricano en versión abrigada.",
  },
  {
    key: "Crusaders_heritage",
    nombre: "Crusaders Heritage",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta Heritage de los Crusaders, edición especial que rinde homenaje a la historia del club más exitoso del Super Rugby.",
  },
  {
    key: "Crusaders_suplente",
    nombre: "Crusaders Suplente",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta suplente de los Crusaders, el club más ganador en la historia del Super Rugby.",
  },
  {
    key: "Crusaders_titular",
    nombre: "Crusaders Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular de los Crusaders, el rojo que domina el rugby del Super Rugby desde Canterbury.",
  },
  {
    key: "Escocia_Murrayfield100",
    nombre: "Escocia Murrayfield 100 Años",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta conmemorativa de los 100 años del estadio Murrayfield, edición especial del seleccionado escocés.",
  },
  {
    key: "Escocia_entrenamiento",
    nombre: "Escocia Entrenamiento",
    categoria: "training",
    tipo: "nacion",
    descripcion:
      "Camiseta de entrenamiento de Escocia, diseñada para la preparación del seleccionado escocés.",
  },
  {
    key: "Escocia_suplente_24-25",
    nombre: "Escocia Suplente 24/25",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta suplente de Escocia temporada 2024/25, con diseño alternativo del cardo nacional.",
  },
  {
    key: "Escocia_suplente_25-26",
    nombre: "Escocia Suplente 25/26",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta suplente de Escocia temporada 2025/26, con diseño alternativo del cardo nacional.",
  },
  {
    key: "Escocia_titular",
    nombre: "Escocia Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de Escocia, el azul marino con el cardo nacional que identifica al rugby escocés.",
  },
  {
    key: "Fiji_titular",
    nombre: "Fiji Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de Fiji, el blanco y negro que representa al seleccionado de las islas del Pacífico.",
  },
  {
    key: "FijianDrua_musculosa_azul",
    nombre: "Fijian Drua Musculosa Azul",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Musculosa azul de los Fijian Drua, la franquicia de Fiyi que compite en el Super Rugby Pacific.",
  },
  {
    key: "FijianDrua_musculosa_verde",
    nombre: "Fijian Drua Musculosa Verde",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Musculosa verde de los Fijian Drua, versión alternativa de la franquicia fidjiana del Super Rugby Pacific.",
  },
  {
    key: "Francia_edicionEspecial",
    nombre: "Francia Edición Especial",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta edición especial de Francia, un diseño único que celebra el espíritu creativo del rugby francés.",
  },
  {
    key: "Francia_suplente",
    nombre: "Francia Suplente",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta suplente de Francia con el elegante diseño alternativo de la federación francesa de rugby.",
  },
  {
    key: "Francia_titular_24-25",
    nombre: "Francia Titular 24/25",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular del XV de France temporada 2024/25, el azul profundo que marca cada conquista del seleccionado galo.",
  },
  {
    key: "Francia_titular",
    nombre: "Francia Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular del XV de France, el azul profundo que marca cada conquista del seleccionado galo.",
  },
  {
    key: "Gales_local",
    nombre: "Gales Local",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta local del seleccionado galés, el rojo pasión que identifica a los hombres del dragón.",
  },
  {
    key: "Gales_suplente",
    nombre: "Gales Suplente",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta suplente de Gales con diseño alternativo que mantiene los colores del dragón galés.",
  },
  {
    key: "Harlequins_titular",
    nombre: "Harlequins Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular de los Harlequins con el icónico diseño de cuartos multicolores del club londinense.",
  },
  {
    key: "Harlequins_visitante_bigGame",
    nombre: "Harlequins Visitante Big Game",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta visitante Big Game de los Harlequins, edición especial para el partido más importante de la temporada.",
  },
  {
    key: "Harlequins_visitante",
    nombre: "Harlequins Visitante",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta visitante de los Harlequins, diseño alternativo del famoso club de Londres.",
  },
  {
    key: "Highlanders_suplente",
    nombre: "Highlanders Suplente",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta suplente de los Highlanders, la franquicia de Otago y Southland en el Super Rugby.",
  },
  {
    key: "Highlanders_titular",
    nombre: "Highlanders Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular de los Highlanders, la franquicia del sur de Nueva Zelanda en el Super Rugby.",
  },
  {
    key: "Hurricanes_suplente",
    nombre: "Hurricanes Suplente",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta suplente de los Hurricanes, la franquicia de Wellington con el juego más vistoso del Super Rugby.",
  },
  {
    key: "Hurricanes_titular",
    nombre: "Hurricanes Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular de los Hurricanes, la franquicia de Wellington con el juego más vistoso del Super Rugby.",
  },
  {
    key: "Inglaterra_alternativa",
    nombre: "Inglaterra Alternativa",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta alternativa de Inglaterra con diseño moderno que complementa la clásica blanca de la RFU.",
  },
  {
    key: "Inglaterra_titular",
    nombre: "Inglaterra Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de Inglaterra, el blanco clásico con la rosa roja de la Rugby Football Union.",
  },
  {
    key: "Inglaterra_visitante_24-25",
    nombre: "Inglaterra Visitante 24/25",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta visitante de Inglaterra temporada 2024/25, diseño alternativo de la Rugby Football Union.",
  },
  {
    key: "Inglaterra_visitante_25-26",
    nombre: "Inglaterra Visitante 25/26",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta visitante de Inglaterra temporada 2025/26, diseño alternativo de la Rugby Football Union.",
  },
  {
    key: "Irlanda_edicionEspecial150",
    nombre: "Irlanda Edición Especial 150",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta edición especial de los 150 años del rugby irlandés, conmemoración histórica de la IRFU.",
  },
  {
    key: "Irlanda_musculosa",
    nombre: "Irlanda Musculosa",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Musculosa del seleccionado irlandés, el verde del trébol de la IRFU en versión sin mangas.",
  },
  {
    key: "Irlanda_prepartido",
    nombre: "Irlanda Prepartido",
    categoria: "training",
    tipo: "nacion",
    descripcion:
      "Camiseta de prepartido de Irlanda, diseñada para el calentamiento y la preparación pre-match del seleccionado irlandés.",
  },
  {
    key: "Irlanda_suplente",
    nombre: "Irlanda Suplente",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta suplente del seleccionado irlandés con diseño alternativo y el trébol de la IRFU.",
  },
  {
    key: "Irlanda_titular",
    nombre: "Irlanda Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de Irlanda, el verde que une a las cuatro provincias bajo el trébol de la IRFU.",
  },
  {
    key: "Leinster_suplente",
    nombre: "Leinster Suplente",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta suplente del Leinster, el club de Champions Cup más ganador del rugby europeo.",
  },
  {
    key: "Leinster_titular",
    nombre: "Leinster Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular del Leinster, el azul que domina el rugby europeo con múltiples Champions Cups.",
  },
  {
    key: "Munster_edicionEspecial",
    nombre: "Munster Edición Especial",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta edición especial del Munster, diseño exclusivo que celebra la pasión del rugby en la provincia irlandesa.",
  },
  {
    key: "Munster_local",
    nombre: "Munster Local",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta local del Munster, el rojo sangre que representa la pasión del rugby en la provincia irlandesa.",
  },
  {
    key: "Northampton_suplente",
    nombre: "Northampton Suplente",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta suplente de los Northampton Saints, el club de Franklin's Gardens en la Premiership inglesa.",
  },
  {
    key: "Northampton_titular",
    nombre: "Northampton Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular de los Northampton Saints, el verde y negro de uno de los grandes clubes ingleses.",
  },
  {
    key: "Pumas_titular",
    nombre: "Pumas Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de Los Pumas, el celeste y blanco del seleccionado argentino que compite entre las mejores del mundo.",
  },
  {
    key: "Springboks_sevens",
    nombre: "Springboks Sevens",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta de los Springboks Sevens, el seleccionado sudafricano del rugby de 7 que domina las series mundiales.",
  },
  {
    key: "Springboks_sevens_suplente",
    nombre: "Springboks Sevens Suplente",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta suplente de los Springboks Sevens, diseño alternativo del seleccionado de 7 de Sudáfrica.",
  },
  {
    key: "Springboks_sevens_titular",
    nombre: "Springboks Sevens Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de los Springboks Sevens, el verde y dorado del rugby de 7 sudafricano.",
  },
  {
    key: "Springboks_suplente",
    nombre: "Springboks Suplente",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta suplente de los Springboks, el diseño alternativo de los campeones del mundo de rugby.",
  },
  {
    key: "Springboks_titular",
    nombre: "Springboks Titular",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de los Springboks, el verde y dorado de los campeones del mundo de rugby.",
  },
  {
    key: "Toulouse_cityEdition",
    nombre: "Toulouse City Edition",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta City Edition del Stade Toulousain, diseño exclusivo que celebra la ciudad del rugby francés.",
  },
  {
    key: "Toulouse_entrenamiento",
    nombre: "Toulouse Entrenamiento",
    categoria: "training",
    tipo: "club",
    descripcion:
      "Camiseta de entrenamiento del Stade Toulousain, para la preparación del club más ganador de Europa.",
  },
  {
    key: "Toulouse_suplente",
    nombre: "Toulouse Suplente",
    categoria: "alternativa",
    tipo: "club",
    descripcion:
      "Camiseta suplente del Stade Toulousain, el diseño alternativo del club más ganador de Europa.",
  },
  {
    key: "Toulouse_titular",
    nombre: "Toulouse Titular",
    categoria: "local",
    tipo: "club",
    descripcion:
      "Camiseta titular del Stade Toulousain, el rojo y negro del club más ganador de la historia del rugby europeo.",
  },
  {
    key: "Wallabies_aborigen",
    nombre: "Wallabies Aborigen",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Camiseta edición aborigen de los Wallabies, diseño especial que rinde homenaje a la cultura indígena australiana.",
  },
  {
    key: "Wallabies_musculosa_aborigen",
    nombre: "Wallabies Musculosa Aborigen",
    categoria: "alternativa",
    tipo: "nacion",
    descripcion:
      "Musculosa aborigen de los Wallabies, diseño sin mangas que celebra la cultura indígena australiana.",
  },
  {
    key: "Wallabies_titular_25-26",
    nombre: "Wallabies Titular 25/26",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de los Wallabies temporada 2025/26, el amarillo dorado de Australia con el canguro del rugby nacional.",
  },
  {
    key: "Wallabies_titular_25",
    nombre: "Wallabies Titular 2025",
    categoria: "local",
    tipo: "nacion",
    descripcion:
      "Camiseta titular de los Wallabies 2025, el amarillo dorado de Australia con el canguro del rugby nacional.",
  },
];

// Detectar qué archivos existen en el directorio
import { readdirSync } from "fs";

const archivos = new Set(
  readdirSync(
    "/Users/segundo/Desktop/pw-e-commerce/public/catalogo"
  ).map((f) => f.replace(".jpg", ""))
);

// Verificar que todos los productos tienen su imagen frente
const productosConImagenes = productos.map((p) => {
  const tieneFrente = archivos.has(`${p.key}_frente`);
  const tieneEspalda = archivos.has(`${p.key}_espalda`);
  if (!tieneFrente) {
    // Algunos productos solo tienen frente en el nombre (Bath)
    const tieneSolo = archivos.has(p.key);
    if (!tieneSolo) {
      console.warn(`⚠️  Sin imagen frente para: ${p.key}`);
    }
  }
  return {
    ...p,
    imagen: tieneFrente
      ? `/catalogo/${p.key}_frente.jpg`
      : `/catalogo/${p.key}.jpg`,
    imagen_espalda: tieneEspalda ? `/catalogo/${p.key}_espalda.jpg` : "",
  };
});

async function main() {
  console.log("=== Seed catálogo Zeus ===\n");

  // 1. Obtener estado actual
  const { data: actuales, error: errLeer } = await supabase
    .from("productos_catalogo")
    .select("id, nombre");
  if (errLeer) {
    console.error("Error leyendo catálogo actual:", errLeer.message);
    process.exit(1);
  }
  console.log(`Productos actuales en BD: ${actuales.length}`);

  // 2. Borrar TODOS los productos del catálogo
  if (actuales.length > 0) {
    const ids = actuales.map((p) => p.id);
    const { error: errBorrar } = await supabase
      .from("productos_catalogo")
      .delete()
      .in("id", ids);
    if (errBorrar) {
      console.error("Error borrando productos:", errBorrar.message);
      process.exit(1);
    }
    console.log(`✅ Borrados ${ids.length} productos existentes\n`);
  } else {
    console.log("ℹ️  No había productos existentes\n");
  }

  // 3. Insertar nuevos productos
  const registros = productosConImagenes.map((p, i) => ({
    id: `cat_${Date.now()}_${i}`,
    nombre: p.nombre,
    precio: PRECIO,
    categoria: p.categoria,
    tipo: p.tipo,
    talle: TALLES_DEFAULT,
    descripcion: p.descripcion,
    imagen: p.imagen,
    imagen_espalda: p.imagen_espalda,
    stock: 0,
    descuento_transferencia: 0,
  }));

  // Insertar en batches de 20 para no superar límites
  const BATCH = 20;
  let insertados = 0;
  for (let i = 0; i < registros.length; i += BATCH) {
    const batch = registros.slice(i, i + BATCH);
    const { error: errIns } = await supabase
      .from("productos_catalogo")
      .insert(batch);
    if (errIns) {
      console.error(
        `Error insertando batch ${i / BATCH + 1}:`,
        errIns.message
      );
      process.exit(1);
    }
    insertados += batch.length;
    console.log(
      `  Insertados ${insertados}/${registros.length} productos...`
    );
  }

  console.log(`\n✅ Catálogo actualizado con ${registros.length} productos.`);
  console.log("\nProductos insertados:");
  registros.forEach((r) =>
    console.log(`  - [${r.tipo}][${r.categoria}] ${r.nombre}`)
  );
}

main();
