"use client";

import { useState, useEffect, useRef } from "react";
import { FaPlus, FaEdit, FaTrash, FaTimes, FaUpload, FaSpinner, FaPercentage } from "react-icons/fa";

const TALLES = ["S", "M", "L", "XL", "2XL", "3XL"];
const CATEGORIAS = ["local", "alternativa", "training"];
const TIPOS = ["nacion", "club"];

const FORM_INICIAL = {
  nombre: "", precio: "", categoria: "local",
  tipo: "nacion", talle: [], descripcion: "",
  imagen: "", imagenEspalda: "", imagenesExtra: ["", "", "", ""],
  stockPorTalle: {}, descuentoTransferencia: "0", tipoVariante: "talle",
};

function formatearPrecio(precio) {
  return "$" + Number(precio).toLocaleString("es-AR");
}

// El stock total no se carga a mano: es la suma del stock de los talles
// activos. Así nunca queda desfasado del stock por talle. Si el producto no
// tiene stock por talle (productos viejos), se usa el stock global guardado.
function stockTotal(p) {
  const talles   = p.talle ?? [];
  const porTalle = p.stock_por_talle ?? {};
  if (!talles.some((t) => porTalle[t] !== undefined)) return Number(p.stock) || 0;
  return talles.reduce((s, t) => s + (Number(porTalle[t]) || 0), 0);
}

function ImageUploader({ label, value, onChange }) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef();

  async function comprimirImagen(file) {
    const MAX_WIDTH = 1200;
    const QUALITY   = 0.8;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);

        const ratio = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);

        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("toBlob fallo")); return; }
            resolve(new File([blob], `${Date.now()}.webp`, { type: "image/webp" }));
          },
          "image/webp",
          QUALITY,
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("img load fallo")); };
      img.src = url;
    });
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const comprimida = await comprimirImagen(file);
      const fd = new FormData();
      fd.append("file", comprimida);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      onChange(data.url ?? "");
    } catch (err) {
      console.error("Error procesando imagen:", err);
      alert("Error procesando la imagen. Intentá de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-600">{label}</label>
      <div
        onClick={() => !subiendo && inputRef.current?.click()}
        className={`relative h-32 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors overflow-hidden ${
          value ? "border-gray-300 bg-white" : "border-gray-300 bg-gray-100 hover:border-orange-500"
        }`}
      >
        {subiendo ? (
          <FaSpinner className="text-orange-500 text-2xl animate-spin" />
        ) : value ? (
          <>
            <img src={value} alt={label} className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(""); }}
              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-500"
            >
              <FaTimes />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-500">
            <FaUpload className="text-xl" />
            <span className="text-xs">Subir imagen</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}

export default function ProductoPanel({ tabla, titulo, seccion = "camiseta", variante = "talle", talles = TALLES }) {
  const esColor = variante === "color";
  const labelVariante = esColor ? "color" : "talle";

  const [productos,  setProductos]  = useState([]);
  const [cargando,   setCargando]   = useState(true);
  const [form,       setForm]       = useState(FORM_INICIAL);
  const [editandoId, setEditandoId] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [nuevoColor, setNuevoColor] = useState("");
  const [busqueda,       setBusqueda]       = useState("");
  const [visible,        setVisible]        = useState(15);
  const [guardando,      setGuardando]      = useState(false);
  const [error,          setError]          = useState(null);
  const [modalAjuste,    setModalAjuste]    = useState(false);
  const [ajusteTipo,     setAjusteTipo]     = useState("descuento_transferencia");
  const [ajusteValor,    setAjusteValor]    = useState("");
  const [ajustandoPrecio, setAjustandoPrecio] = useState(false);
  const formRef = useRef();

  useEffect(() => { fetchProductos(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function fetchProductos() {
    setCargando(true);
    const res = await fetch(`/api/admin/productos/${tabla}`);
    const data = await res.json();
    // Cada panel muestra solo su sección (camisetas vs bucales)
    const filtrados = Array.isArray(data)
      ? data.filter((p) => (p.seccion ?? "camiseta") === seccion)
      : [];
    setProductos(filtrados);
    setCargando(false);
  }

  function abrirNuevo() {
    setForm({
      ...FORM_INICIAL,
      tipoVariante: variante,
      // categoria queda "local" (valor permitido por el check constraint);
      // para bucales no se muestra en la web, solo cumple la restriccion.
      categoria: "local",
    });
    setEditandoId(null);
    setNuevoColor("");
    setFormVisible(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function abrirEditar(p) {
    setForm({
      nombre:                 p.nombre,
      precio:                 String(p.precio),
      categoria:              p.categoria,
      tipo:                   p.tipo,
      talle:                  p.talle ?? [],
      descripcion:            p.descripcion ?? "",
      imagen:                 p.imagen ?? "",
      imagenEspalda:          p.imagen_espalda ?? "",
      imagenesExtra:          [...(p.imagenes_extra ?? []), "", "", "", ""].slice(0, 4),
      stockPorTalle:          p.stock_por_talle ?? {},
      descuentoTransferencia: String(p.descuento_transferencia ?? 0),
      tipoVariante:           p.tipo_variante ?? variante,
    });
    setEditandoId(p.id);
    setNuevoColor("");
    setFormVisible(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  function agregarColor() {
    const c = nuevoColor.trim();
    if (!c || form.talle.includes(c)) { setNuevoColor(""); return; }
    setForm((p) => ({ ...p, talle: [...p.talle, c] }));
    setNuevoColor("");
  }

  function quitarVariante(v) {
    setForm((p) => {
      const sp = { ...p.stockPorTalle };
      delete sp[v];
      return { ...p, talle: p.talle.filter((x) => x !== v), stockPorTalle: sp };
    });
  }

  function cerrarForm() {
    setFormVisible(false);
    setEditandoId(null);
    setError(null);
  }

  function toggleTalle(t) {
    setForm(prev => ({
      ...prev,
      talle: prev.talle.includes(t)
        ? prev.talle.filter(x => x !== t)
        : [...prev.talle, t],
    }));
  }

  async function handleAjustarPrecios(e) {
    e.preventDefault();
    const valor = parseFloat(ajusteValor);
    if (isNaN(valor)) return;
    setAjustandoPrecio(true);
    const res = await fetch(`/api/admin/productos/${tabla}/ajustar-precios`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: ajusteTipo, valor }),
    });
    if (res.ok) {
      setModalAjuste(false);
      setAjusteValor("");
      fetchProductos();
    }
    setAjustandoPrecio(false);
  }

  async function handleEliminar(id, nombre) {
    if (!confirm(`¿Eliminás "${nombre}"? Esta acción no se puede deshacer.`)) return;
    await fetch(`/api/admin/productos/${tabla}/${id}`, { method: "DELETE" });
    fetchProductos();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    // Solo se guardan los talles activos (se descartan los de talles
    // deseleccionados) y el stock total se calcula como su suma.
    const stockPorTalle = Object.fromEntries(
      form.talle.map((t) => [t, Number(form.stockPorTalle[t]) || 0])
    );

    const body = {
      ...form,
      precio: parseInt(form.precio),
      stock: Object.values(stockPorTalle).reduce((s, n) => s + n, 0),
      stockPorTalle,
      descuentoTransferencia: parseInt(form.descuentoTransferencia) || 0,
      imagenesExtra: form.imagenesExtra.filter(Boolean),
      seccion,
      tipoVariante: variante,
    };
    const url  = editandoId
      ? `/api/admin/productos/${tabla}/${editandoId}`
      : `/api/admin/productos/${tabla}`;
    const method = editandoId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      cerrarForm();
      fetchProductos();
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al guardar");
    }
    setGuardando(false);
  }

  const inputClass = "bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors w-full";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-extrabold text-gray-900">{titulo}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalAjuste(true)}
            className="flex items-center gap-2 bg-gray-200 text-gray-900 font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-300 transition-colors text-sm"
          >
            <FaPercentage />
            Ajustar precios
          </button>
          <button
            onClick={abrirNuevo}
            className="flex items-center gap-2 bg-orange-500 text-black font-semibold px-4 py-2.5 rounded-xl hover:bg-orange-400 transition-colors text-sm"
          >
            <FaPlus />
            Nuevo producto
          </button>
        </div>
      </div>

      {/* Formulario de alta/edición */}
      {formVisible && (
        <div ref={formRef} className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              {editandoId ? "Editar producto" : "Nuevo producto"}
            </h2>
            <button onClick={cerrarForm} className="text-gray-500 hover:text-gray-900 transition-colors">
              <FaTimes />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Imágenes */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-4">
                <ImageUploader
                  label="Imagen frente *"
                  value={form.imagen}
                  onChange={(url) => setForm(p => ({ ...p, imagen: url }))}
                />
                <ImageUploader
                  label="Imagen espalda"
                  value={form.imagenEspalda}
                  onChange={(url) => setForm(p => ({ ...p, imagenEspalda: url }))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-500">Fotos adicionales (máx. 4)</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <ImageUploader
                      key={i}
                      label={`Extra ${i + 1}`}
                      value={form.imagenesExtra[i] ?? ""}
                      onChange={(url) => setForm(p => {
                        const next = [...p.imagenesExtra];
                        next[i] = url;
                        return { ...p, imagenesExtra: next };
                      })}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Nombre y precio (el stock se carga por talle, más abajo) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">Nombre *</label>
                <input
                  value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  required placeholder="Argentina Local"
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">Precio (ARS) *</label>
                <input
                  type="number" value={form.precio}
                  onChange={e => setForm(p => ({ ...p, precio: e.target.value }))}
                  required placeholder="70000"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Descuento transferencia */}
            <div className="flex flex-col gap-1 sm:w-1/3">
              <label className="text-xs text-gray-600">Descuento transferencia (%)</label>
              <input
                type="number" min="0" max="100"
                value={form.descuentoTransferencia}
                onChange={e => setForm(p => ({ ...p, descuentoTransferencia: e.target.value }))}
                placeholder="0"
                className={inputClass}
              />
            </div>

            {/* Categoría y tipo — solo para camisetas */}
            {!esColor && (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">Categoría *</label>
                  <select
                    value={form.categoria}
                    onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                    className={inputClass}
                  >
                    {CATEGORIAS.map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600">Tipo *</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                    className={inputClass}
                  >
                    {TIPOS.map(t => (
                      <option key={t} value={t}>{t === "nacion" ? "Nación" : "Club"}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Variantes: talles fijos (camisetas) o colores libres (bucales) */}
            {esColor ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-600">Colores disponibles</label>
                <div className="flex gap-2">
                  <input
                    value={nuevoColor}
                    onChange={(e) => setNuevoColor(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarColor(); } }}
                    placeholder="Ej: Negro, Azul, Transparente..."
                    className={inputClass}
                  />
                  <button
                    type="button" onClick={agregarColor}
                    className="shrink-0 bg-gray-200 text-gray-900 font-semibold px-4 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-600">Talles disponibles</label>
                <div className="flex gap-2 flex-wrap">
                  {talles.map(t => (
                    <button
                      key={t} type="button" onClick={() => toggleTalle(t)}
                      className={`w-12 h-10 rounded-lg border-2 text-sm font-bold transition-colors ${
                        form.talle.includes(t)
                          ? "bg-orange-500 text-black border-orange-500"
                          : "bg-gray-100 text-gray-600 border-gray-300 hover:border-gray-900"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock por variante */}
            {form.talle.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs text-gray-600">
                  Stock por {labelVariante}
                  <span className="text-gray-400"> · Total: {form.talle.reduce((s, t) => s + (Number(form.stockPorTalle[t]) || 0), 0)}</span>
                </label>
                <div className={`grid gap-2 ${esColor ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-6"}`}>
                  {form.talle.map((t) => (
                    <div key={t} className="flex flex-col gap-1 items-center">
                      <span className="text-xs text-gray-500 flex items-center gap-1 max-w-full truncate">
                        {t}
                        {esColor && (
                          <button type="button" onClick={() => quitarVariante(t)} className="text-red-500 hover:text-red-600 shrink-0" title="Quitar">
                            <FaTimes className="text-[10px]" />
                          </button>
                        )}
                      </span>
                      <input
                        type="number" min="0"
                        value={form.stockPorTalle[t] ?? 0}
                        onChange={(e) => setForm((p) => ({
                          ...p,
                          stockPorTalle: { ...p.stockPorTalle, [t]: parseInt(e.target.value) || 0 },
                        }))}
                        className={`${inputClass} text-center px-1`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Descripción */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                rows={3} placeholder="Descripción del producto..."
                className={`${inputClass} resize-none`}
              />
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="submit" disabled={guardando}
                className="flex-1 bg-orange-500 text-black font-bold py-3 rounded-xl hover:bg-orange-400 transition-colors disabled:opacity-50"
              >
                {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear producto"}
              </button>
              <button
                type="button" onClick={cerrarForm}
                className="px-6 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de productos */}
      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <FaSpinner className="text-orange-500 text-3xl animate-spin" />
        </div>
      ) : productos.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg mb-4">No hay productos todavía.</p>
          <button onClick={abrirNuevo} className="text-orange-500 underline hover:text-orange-400">
            Agregá el primero
          </button>
        </div>
      ) : (
        <>
          {!cargando && productos.length > 0 && (
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Buscar producto..."
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setVisible(15); }}
                className="w-full bg-gray-100 border border-gray-300 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors pr-10"
              />
              {busqueda && (
                <button onClick={() => { setBusqueda(""); setVisible(15); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors text-sm">✕</button>
              )}
            </div>
          )}
        <div className="flex flex-col gap-3">
          {(() => {
            const productosMostrados = productos.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
            return (
              <>
                {productosMostrados.slice(0, visible).map(p => (
            <article key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
              {/* Imagen */}
              <div className="shrink-0 w-16 h-16 rounded-lg bg-white overflow-hidden">
                {p.imagen
                  ? <img src={p.imagen} alt={p.nombre} className="w-full h-full object-contain" />
                  : <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">Sin img</div>
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.nombre}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {esColor
                    ? `Colores: ${(p.talle ?? []).join(", ") || "—"}`
                    : `${p.categoria} · ${p.tipo === "nacion" ? "Nación" : "Club"} · Talles: ${(p.talle ?? []).join(", ") || "—"}`}
                </p>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-orange-500 font-bold text-sm">{formatearPrecio(p.precio)}</span>
                  {p.descuento_transferencia > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      Transf. −{p.descuento_transferencia}%
                    </span>
                  )}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${stockTotal(p) > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    Stock: {stockTotal(p)}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => abrirEditar(p)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-orange-500 hover:text-black transition-colors"
                  title="Editar"
                >
                  <FaEdit className="text-sm" />
                </button>
                <button
                  onClick={() => handleEliminar(p.id, p.nombre)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-red-600 hover:text-white transition-colors"
                  title="Eliminar"
                >
                  <FaTrash className="text-sm" />
                </button>
              </div>
            </article>
                ))}
                {productosMostrados.length > visible && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={() => setVisible(v => v + 15)}
                      className="bg-white border border-gray-300 text-gray-700 font-semibold px-8 py-3 rounded-full hover:bg-orange-500 hover:text-black hover:border-orange-500 transition-colors"
                    >
                      Cargar más ({productosMostrados.length - visible} restantes)
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
        </>
      )}

      {/* Modal ajuste masivo de precios */}
      {modalAjuste && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-sm flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Ajustar precios — {titulo}</h2>
              <button onClick={() => setModalAjuste(false)} className="text-gray-500 hover:text-gray-900 transition-colors">
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleAjustarPrecios} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">Qué cambiar</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setAjusteTipo("descuento_transferencia"); setAjusteValor(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${ajusteTipo === "descuento_transferencia" ? "bg-orange-500 text-black border-orange-500" : "bg-gray-100 text-gray-600 border-gray-300 hover:border-gray-900"}`}
                  >
                    % Transferencia
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAjusteTipo("precio"); setAjusteValor(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${ajusteTipo === "precio" ? "bg-orange-500 text-black border-orange-500" : "bg-gray-100 text-gray-600 border-gray-300 hover:border-gray-900"}`}
                  >
                    $ Precio base
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-600">
                  {ajusteTipo === "descuento_transferencia"
                    ? "% de descuento para transferencia (ej: 10 = 10% de descuento)"
                    : "Nuevo precio base para TODOS los productos ($)"}
                </label>
                <input
                  type="number"
                  min="0"
                  value={ajusteValor}
                  onChange={(e) => setAjusteValor(e.target.value)}
                  required
                  placeholder={ajusteTipo === "descuento_transferencia" ? "10" : "70000"}
                  className="bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>

              <p className="text-xs text-gray-500">
                {ajusteTipo === "descuento_transferencia"
                  ? <>Establece el <strong className="text-gray-600">descuento por transferencia</strong> para <strong className="text-gray-600">todos</strong> los productos.</>
                  : <>Fija el <strong className="text-gray-600">precio base</strong> (sin transferencia) de <strong className="text-gray-600">todos</strong> los productos a ese valor.</>
                }
              </p>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={ajustandoPrecio || !ajusteValor}
                  className="flex-1 bg-orange-500 text-black font-bold py-3 rounded-xl hover:bg-orange-400 transition-colors disabled:opacity-50"
                >
                  {ajustandoPrecio ? "Aplicando..." : "Aplicar a todos"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalAjuste(false)}
                  className="px-5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
