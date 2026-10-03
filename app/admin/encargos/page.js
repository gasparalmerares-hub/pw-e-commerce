"use client";

import { useState, useEffect } from "react";
import { FaSpinner, FaWhatsapp, FaDownload, FaTimes, FaCheck, FaImages } from "react-icons/fa";
import { personalizacionesDe } from "@/lib/personalizacion";
import { armarImagenCamiseta } from "@/lib/imagenCamiseta";
import { CARGA_ENCARGO, camisetasEnCarga } from "@/lib/mayorista";

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
        perss:   personalizacionesDe(p, item), // una por unidad (null = sin parche)
      });
    });
  }
  // Los pedidos más viejos primero: son los que hay que encargar antes
  return filas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
}

// ─── Imagen para el proveedor: foto + talle, nombre y número en grande ──────

// Una imagen por camiseta (unidad), con su propia personalización
function armarImagen(fila, pers, n) {
  // Mismo formato que se le manda al proveedor: talle, nombre y #número
  const lineas = [String(fila.item.talle)];
  if (pers?.nombre) lineas.push(pers.nombre.toUpperCase());
  if (pers?.numero) lineas.push(`#${pers.numero}`);
  if (pers && !pers.nombre && !pers.numero) lineas.push(pers.texto.toUpperCase());
  return armarImagenCamiseta({
    imagen: fila.item.imagen,
    lineas,
    nombreArchivo: `encargo-${String(n).padStart(2, "0")}.jpg`,
  });
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
  const [cargaAuto,  setCargaAuto]  = useState(0);    // camisetas mayoristas a medida esperando carga
  const [ajuste,     setAjuste]     = useState("0"); // ajuste manual (camisetas propias, correcciones)
  const [ajusteDB,   setAjusteDB]   = useState("0");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  async function cargar() {
    try {
      const res = await fetch(`/api/admin/pedidos?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error(data.error ?? "Error al cargar los pedidos");
      setFilas(armarFilas(data));
      setCargaAuto(camisetasEnCarga(data));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    fetch(`/api/admin/config?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { const v = String(parseInt(d.carga_ajuste) || 0); setAjuste(v); setAjusteDB(v); })
      .catch(() => {});
  }, []);

  async function guardarAjuste() {
    setGuardandoAjuste(true);
    try {
      const valor = String(parseInt(ajuste) || 0);
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carga_ajuste: valor }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error al guardar");
      setAjuste(valor);
      setAjusteDB(valor);
    } catch (err) {
      alert(err.message);
    } finally {
      setGuardandoAjuste(false);
    }
  }

  const cargaTotal = Math.max(0, cargaAuto + (parseInt(ajuste) || 0));

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
      // Una imagen por unidad: 2 camisetas iguales con nombres distintos son 2 fotos
      const lista = [];
      for (const fila of elegidas) {
        for (const pers of fila.perss) {
          const file = await armarImagen(fila, pers, lista.length + 1);
          lista.push({ file, url: URL.createObjectURL(file) });
        }
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

      {/* Carga a fábrica de los pedidos a medida mayoristas (se muestra en /mayorista) */}
      <section className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-bold text-gray-900">Carga mayorista a fábrica</h2>
          <p className="text-sm text-gray-700"><strong className="text-lg text-gray-900">{cargaTotal}</strong> / {CARGA_ENCARGO}</p>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden my-2">
          <div className={`h-full rounded-full ${cargaTotal >= CARGA_ENCARGO ? "bg-green-600" : "bg-orange-500"}`} style={{ width: `${Math.min(100, (cargaTotal / CARGA_ENCARGO) * 100)}%` }} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
          <span>Pedidos a medida con seña: <strong>{cargaAuto}</strong></span>
          <label className="flex items-center gap-2">
            + Ajuste manual
            <input
              type="number" value={ajuste} onChange={(e) => setAjuste(e.target.value)}
              className="w-20 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-gray-900 text-center focus:outline-none focus:border-orange-500"
            />
          </label>
          {String(parseInt(ajuste) || 0) !== ajusteDB && (
            <button onClick={guardarAjuste} disabled={guardandoAjuste} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-black hover:bg-orange-400 disabled:opacity-50">
              {guardandoAjuste ? "Guardando..." : "Guardar"}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Sumá tus camisetas propias (o corregí el número) con el ajuste. Lo que ves acá es lo que ven los clientes en Mayorista.
          Al despachar la carga, marcá las camisetas como encargadas y volvé el ajuste a 0.
        </p>
      </section>

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
                    {f.perss.length === 1 && f.perss[0] && <> · <strong className="text-orange-600">{f.perss[0].texto.toUpperCase()}</strong></>}
                  </p>
                  {f.perss.length > 1 && f.perss.some(Boolean) && (
                    <p className="text-xs text-gray-700">
                      {f.perss.map((p, u) => (
                        <span key={u} className="mr-3">
                          {u + 1}: {p ? <strong className="text-orange-600">{p.texto.toUpperCase()}</strong> : "sin estampa"}
                        </span>
                      ))}
                    </p>
                  )}
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
