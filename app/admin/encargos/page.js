"use client";

import { useState, useEffect } from "react";
import { FaSpinner, FaWhatsapp, FaDownload, FaTimes, FaCheck, FaImages } from "react-icons/fa";
import { personalizacionDe } from "@/lib/personalizacion";

// Camisetas por encargo de los pedidos pagados, agrupadas según qué pasó con
// el proveedor. El estado vive en cada item del pedido (ver /api/admin/encargos).
const PESTANAS = [
  { id: "por_encargar", label: "Por encargar" },
  { id: "encargado",    label: "Encargadas"   },
  { id: "llego",        label: "Llegaron"     },
];

function formatearFecha(iso) {
  return iso ? new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "";
}

// Una fila por camiseta por encargo (catálogo y niños) de los pedidos pagados.
// Los pedidos ya enviados o entregados no aparecen: ya se despacharon.
function armarFilas(pedidos) {
  const filas = [];
  for (const p of pedidos) {
    if (p.estado !== "pagado") continue;
    (p.items ?? []).forEach((item, index) => {
      if (item.tabla !== "productos_catalogo") return;
      filas.push({
        key:     `${p.id}:${index}`,
        pedidoId: p.id,
        index,
        item,
        cliente: p.nombre,
        fecha:   p.created_at,
        estado:  item.encargo?.estado ?? "por_encargar",
        pers:    personalizacionDe(p, item),
      });
    });
  }
  // Los pedidos más viejos primero: son los que hay que encargar antes
  return filas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

// ─── Imagen para el proveedor: foto + talle, nombre y número en grande ──────

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

async function armarImagen(fila, n) {
  const W = 1080, H = 1350, FOTO = 960, BASE_TEXTO = 1030;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  try {
    const img = await cargarImagen(fila.item.imagen);
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

  // Mismo formato que se le manda al proveedor: talle, nombre y #número
  const cantidad = Number(fila.item.cantidad) || 1;
  const lineas = [`${fila.item.talle}${cantidad > 1 ? `  ·  x${cantidad}` : ""}`];
  if (fila.pers?.nombre) lineas.push(fila.pers.nombre.toUpperCase());
  if (fila.pers?.numero) lineas.push(`#${fila.pers.numero}`);
  if (fila.pers && !fila.pers.nombre && !fila.pers.numero) lineas.push(fila.pers.texto.toUpperCase());

  const alto = (H - BASE_TEXTO - 20) / lineas.length;
  lineas.forEach((linea, i) => {
    fuenteQueEntra(ctx, linea, W - 120, Math.min(130, alto * 0.8));
    ctx.fillText(linea, W / 2, BASE_TEXTO + alto * (i + 1) - alto * 0.2);
  });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return new File([blob], `encargo-${String(n).padStart(2, "0")}.jpg`, { type: "image/jpeg" });
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function EncargosPage() {
  const [filas,      setFilas]      = useState([]);
  const [cargando,   setCargando]   = useState(true);
  const [error,      setError]      = useState(null);
  const [pestana,    setPestana]    = useState("por_encargar");
  const [seleccion,  setSeleccion]  = useState(new Set());
  const [guardando,  setGuardando]  = useState(false);
  const [preparando, setPreparando] = useState(false);
  const [imagenes,   setImagenes]   = useState(null); // [{ file, url }]

  async function cargar() {
    try {
      const res = await fetch(`/api/admin/pedidos?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error(data.error ?? "Error al cargar los pedidos");
      setFilas(armarFilas(data));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  const visibles     = filas.filter((f) => f.estado === pestana);
  const elegidas     = visibles.filter((f) => seleccion.has(f.key));
  const todasElegidas = visibles.length > 0 && elegidas.length === visibles.length;

  function cambiarPestana(id) {
    setPestana(id);
    setSeleccion(new Set());
  }

  function alternar(key) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function alternarTodas() {
    setSeleccion(todasElegidas ? new Set() : new Set(visibles.map((f) => f.key)));
  }

  async function moverA(estado) {
    if (elegidas.length === 0) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/admin/encargos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cambios: elegidas.map((f) => ({
            pedidoId: f.pedidoId, index: f.index, id: f.item.id, talle: f.item.talle, estado,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al guardar");
      setSeleccion(new Set());
      cerrarImagenes();
      await cargar();
    } catch (err) {
      alert(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function prepararImagenes() {
    if (elegidas.length === 0) return;
    setPreparando(true);
    try {
      const lista = [];
      for (let i = 0; i < elegidas.length; i++) {
        const file = await armarImagen(elegidas[i], i + 1);
        lista.push({ file, url: URL.createObjectURL(file) });
      }
      setImagenes(lista);
    } catch (err) {
      alert("No se pudieron armar las imágenes: " + err.message);
    } finally {
      setPreparando(false);
    }
  }

  function cerrarImagenes() {
    imagenes?.forEach((img) => URL.revokeObjectURL(img.url));
    setImagenes(null);
  }

  // Se llama desde un toque del usuario (las imágenes ya están armadas),
  // porque el celular solo abre el menú de compartir en respuesta a un toque.
  const files = imagenes?.map((img) => img.file) ?? [];
  const puedeCompartir = typeof navigator !== "undefined" && navigator.canShare?.({ files }) && files.length > 0;

  async function compartir() {
    try {
      await navigator.share({ files });
    } catch (err) {
      if (err?.name !== "AbortError") alert("No se pudo compartir. Probá con Descargar.");
    }
  }

  async function descargar() {
    for (const img of imagenes ?? []) {
      const a = document.createElement("a");
      a.href = img.url;
      a.download = img.file.name;
      a.click();
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Encargos</h1>
      <p className="text-sm text-gray-500 mb-6">Camisetas por encargo de pedidos pagados.</p>

      {/* Pestañas */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {PESTANAS.map(({ id, label }) => {
          const n = filas.filter((f) => f.estado === id).length;
          return (
            <button
              key={id}
              onClick={() => cambiarPestana(id)}
              className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-full transition-colors ${
                pestana === id ? "bg-orange-500 text-black" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label} ({n})
            </button>
          );
        })}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <FaSpinner className="text-orange-500 text-3xl animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
      ) : visibles.length === 0 ? (
        <p className="text-center text-gray-500 py-20">No hay camisetas en esta pestaña.</p>
      ) : (
        <>
          {/* Acciones */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button onClick={alternarTodas} className="text-xs font-semibold px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
              {todasElegidas ? "Quitar selección" : "Seleccionar todas"}
            </button>
            <span className="text-xs text-gray-500 mr-auto">{elegidas.length} seleccionada{elegidas.length !== 1 ? "s" : ""}</span>

            {pestana === "por_encargar" && (
              <>
                <BotonAccion onClick={prepararImagenes} disabled={!elegidas.length || preparando} icon={preparando ? FaSpinner : FaImages} spin={preparando}>
                  {preparando ? "Armando imágenes..." : "Preparar para el proveedor"}
                </BotonAccion>
                <BotonAccion onClick={() => moverA("encargado")} disabled={!elegidas.length || guardando} icon={FaCheck} secundario>
                  Marcar como encargadas
                </BotonAccion>
              </>
            )}
            {pestana === "encargado" && (
              <>
                <BotonAccion onClick={() => moverA("llego")} disabled={!elegidas.length || guardando} icon={FaCheck}>
                  Marcar como llegadas
                </BotonAccion>
                <BotonAccion onClick={() => moverA("por_encargar")} disabled={!elegidas.length || guardando} secundario>
                  Volver a Por encargar
                </BotonAccion>
              </>
            )}
            {pestana === "llego" && (
              <BotonAccion onClick={() => moverA("encargado")} disabled={!elegidas.length || guardando} secundario>
                Volver a Encargadas
              </BotonAccion>
            )}
          </div>

          {/* Lista */}
          <div className="flex flex-col gap-2">
            {visibles.map((f) => (
              <label
                key={f.key}
                className={`flex items-center gap-3 bg-white border rounded-xl p-3 cursor-pointer transition-colors ${
                  seleccion.has(f.key) ? "border-orange-500 bg-orange-50" : "border-gray-200"
                }`}
              >
                <input
                  type="checkbox"
                  checked={seleccion.has(f.key)}
                  onChange={() => alternar(f.key)}
                  className="w-5 h-5 accent-orange-500 shrink-0"
                />
                <div className="shrink-0 w-14 h-14 rounded-lg bg-white overflow-hidden border border-gray-100">
                  {f.item.imagen && <img src={f.item.imagen} alt={f.item.nombre} className="w-full h-full object-contain" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{f.item.nombre}</p>
                  <p className="text-sm text-gray-700">
                    Talle <strong>{f.item.talle}</strong>
                    {Number(f.item.cantidad) > 1 && <> · <strong>x{f.item.cantidad}</strong></>}
                    {f.pers && <> · <strong className="text-orange-600">{f.pers.texto.toUpperCase()}</strong></>}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {f.cliente ?? "—"} · pedido del {formatearFecha(f.fecha)}
                    {f.estado === "encargado" && ` · encargada el ${formatearFecha(f.item.encargo?.encargadoEl)}`}
                    {f.estado === "llego" && ` · llegó el ${formatearFecha(f.item.encargo?.llegoEl)}`}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      {/* Imágenes listas para mandar al proveedor */}
      {imagenes && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center sm:px-4">
          <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] rounded-t-2xl sm:rounded-2xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">{imagenes.length === 1 ? "1 imagen" : `${imagenes.length} imágenes`} para el proveedor</h2>
              <button onClick={cerrarImagenes} className="text-gray-500 hover:text-gray-900"><FaTimes /></button>
            </div>

            <div className="overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imagenes.map((img) => (
                <img key={img.url} src={img.url} alt={img.file.name} className="w-full rounded-lg border border-gray-200" />
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 flex flex-col gap-2">
              {puedeCompartir && (
                <button onClick={compartir} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-500">
                  <FaWhatsapp className="text-lg" /> Compartir por WhatsApp
                </button>
              )}
              <button onClick={descargar} className={`w-full flex items-center justify-center gap-2 font-bold py-3 rounded-xl ${puedeCompartir ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-green-600 text-white hover:bg-green-500"}`}>
                <FaDownload /> Descargar imágenes
              </button>
              <button
                onClick={() => moverA("encargado")}
                disabled={guardando}
                className="w-full flex items-center justify-center gap-2 border border-orange-500 text-orange-600 font-bold py-3 rounded-xl hover:bg-orange-50 disabled:opacity-50"
              >
                <FaCheck /> Ya las mandé: marcarlas como encargadas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotonAccion({ onClick, disabled, icon: Icon, spin = false, secundario = false, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40 ${
        secundario ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-orange-500 text-black hover:bg-orange-400"
      }`}
    >
      {Icon && <Icon className={spin ? "animate-spin" : ""} />}
      {children}
    </button>
  );
}
