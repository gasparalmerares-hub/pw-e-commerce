"use client";

import { useState, useEffect } from "react";
import { FaSpinner, FaChevronDown, FaChevronUp, FaBox, FaTimes, FaCopy, FaCheck } from "react-icons/fa";

const ESTADOS = ["pendiente_transferencia", "pagado", "enviado", "entregado", "cancelado"];

const badgeEstado = {
  pendiente:              "bg-gray-200 text-gray-600",
  pendiente_transferencia:"bg-yellow-100 text-yellow-700",
  pagado:                 "bg-blue-100 text-blue-700",
  enviado:    "bg-orange-100 text-orange-700",
  entregado:  "bg-green-100 text-green-700",
  cancelado:  "bg-red-100 text-red-600",
};

function formatearFecha(iso) {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatearPrecio(n) {
  return "$" + Number(n).toLocaleString("es-AR");
}

function EstadoBadge({ estado }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${badgeEstado[estado] ?? "bg-gray-200 text-gray-600"}`}>
      {estado}
    </span>
  );
}

function PedidoCard({ pedido, onEstadoChange, onEliminar }) {
  const [abierto,     setAbierto]     = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [eliminando,  setEliminando]  = useState(false);
  const [estadoLocal, setEstadoLocal] = useState(pedido.estado);

  async function cambiarEstado(nuevoEstado) {
    if (nuevoEstado === estadoLocal) return;
    setGuardando(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${pedido.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (res.ok) {
        setEstadoLocal(nuevoEstado);
        onEstadoChange?.(pedido.id, nuevoEstado);
      }
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(e) {
    e.stopPropagation();
    if (!confirm(`¿Eliminás el pedido de ${pedido.nombre ?? "este cliente"}? Esta acción no se puede deshacer.`)) return;
    setEliminando(true);
    try {
      const res = await fetch(`/api/admin/pedidos/${pedido.id}`, { method: "DELETE" });
      if (res.ok) onEliminar?.(pedido.id);
    } finally {
      setEliminando(false);
    }
  }

  const items = pedido.items ?? [];

  return (
    <article className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Cabecera siempre visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-4 text-left"
        onClick={() => setAbierto(!abierto)}
      >
        <FaBox className="text-orange-500 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900 text-sm truncate">{pedido.nombre ?? "—"}</span>
            <EstadoBadge estado={estadoLocal} />
            {(pedido.estado === "pendiente_transferencia" || pedido.metodo_pago === "transferencia" || (pedido.observaciones ?? "").includes("[TRANSFERENCIA]")) && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                Transferencia
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatearFecha(pedido.created_at)} · {items.length} artículo{items.length !== 1 ? "s" : ""} · <span className="text-orange-400 font-medium">{formatearPrecio(pedido.total)}</span>
          </p>
        </div>

        <button
          onClick={handleEliminar}
          disabled={eliminando}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0 disabled:opacity-40"
          aria-label="Eliminar pedido"
        >
          {eliminando ? <FaSpinner className="animate-spin text-xs" /> : <FaTimes className="text-xs" />}
        </button>

        {abierto ? <FaChevronUp className="text-gray-400 shrink-0" /> : <FaChevronDown className="text-gray-400 shrink-0" />}
      </button>

      {/* Detalle expandible */}
      {abierto && (
        <div className="border-t border-gray-200 px-4 pb-5 pt-4 flex flex-col gap-5">

          {/* Cambiar estado */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 font-medium mr-1">Cambiar estado:</span>
            {ESTADOS.map((e) => (
              <button
                key={e}
                disabled={guardando || e === estadoLocal}
                onClick={() => cambiarEstado(e)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors disabled:opacity-40 ${
                  e === estadoLocal
                    ? badgeEstado[e]
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {guardando && e !== estadoLocal ? "..." : e}
              </button>
            ))}
          </div>

          {/* Datos del comprador — cada uno con botón de copiar, en el mismo
              orden que los pide MiCorreo, para cargar el envío rápido */}
          <DatosEnvio pedido={pedido} />
          {(pedido.payment_id || pedido.observaciones) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {pedido.payment_id && <Info label="Payment ID" value={pedido.payment_id} />}
              {pedido.observaciones && <Info label="Observaciones" value={pedido.observaciones} className="sm:col-span-2" />}
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">Productos</p>
            <div className="flex flex-col gap-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-100 rounded-lg px-3 py-2">
                  {item.imagen && (
                    <img src={item.imagen} alt={item.nombre} className="w-10 h-10 object-contain rounded bg-white shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium truncate">{item.nombre}</p>
                    <p className="text-xs text-gray-500">Talle {item.talle} · x{item.cantidad}</p>
                  </div>
                  <span className="text-orange-400 font-bold text-sm shrink-0">{formatearPrecio(item.precio * item.cantidad)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

function BotonCopiar({ texto, label = null, className = "" }) {
  const [copiado, setCopiado] = useState(false);
  async function handleClick(e) {
    e.stopPropagation();
    if (await copiarTexto(texto)) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    }
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      title="Copiar"
      className={`flex items-center justify-center gap-1.5 rounded-lg transition-colors ${
        copiado ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500 hover:bg-orange-500 hover:text-black"
      } ${label ? "px-3 py-1.5 text-xs font-semibold" : "w-7 h-7 shrink-0"} ${className}`}
    >
      {copiado ? <FaCheck className="text-xs" /> : <FaCopy className="text-xs" />}
      {label && (copiado ? "¡Copiado!" : label)}
    </button>
  );
}

function DatosEnvio({ pedido }) {
  const campos = [
    ["Nombre",        pedido.nombre],
    ["Email",         pedido.email],
    ["Teléfono",      pedido.telefono],
    // Un solo campo, igual que el casillero "Dirección (calle, altura, piso y dpto.)" de MiCorreo
    ["Dirección",     [pedido.calle, pedido.numero, pedido.piso && `Piso ${pedido.piso}`, pedido.departamento && `Dpto ${pedido.departamento}`].filter(Boolean).join(" ")],
    ["Localidad",     pedido.localidad],
    ["Provincia",     pedido.provincia],
    ["Cód. Postal",   pedido.codigo_postal],
  ].filter(([, v]) => v);

  const todo = campos.map(([l, v]) => `${l}: ${v}`).join("\n");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 font-medium">Datos de envío</p>
        <BotonCopiar texto={todo} label="Copiar todo" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
        {campos.map(([label, valor]) => (
          <div key={label} className="flex items-center gap-2 min-w-0">
            <BotonCopiar texto={String(valor)} />
            <span className="text-xs text-gray-500 shrink-0">{label}:</span>
            <span className="text-xs text-gray-700 truncate">{valor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value, className = "" }) {
  if (!value) return null;
  return (
    <div className={className}>
      <span className="text-xs text-gray-500">{label}: </span>
      <span className="text-xs text-gray-700">{value}</span>
    </div>
  );
}

export default function AdminPedidosPage() {
  const [pedidos,         setPedidos]         = useState([]);
  const [cargando,        setCargando]        = useState(true);
  const [filtro,          setFiltro]          = useState("todos");
  const [ultimaActualiz,  setUltimaActualiz]  = useState(null);

  async function fetchPedidos(silencioso = false) {
    if (!silencioso) setCargando(true);
    try {
      const res = await fetch(`/api/admin/pedidos?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      setPedidos(Array.isArray(data) ? data : []);
      setUltimaActualiz(new Date());
    } catch (err) {
      console.error("[pedidos] fetch error:", err);
    } finally {
      if (!silencioso) setCargando(false);
    }
  }

  useEffect(() => {
    fetchPedidos();
    // Polling cada 10 segundos para reflejar pagos de MP y nuevas transferencias
    const interval = setInterval(() => fetchPedidos(true), 10000);
    return () => clearInterval(interval);
  }, []);

  function onEstadoChange(id, nuevoEstado) {
    setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, estado: nuevoEstado } : p));
  }

  function onEliminar(id) {
    setPedidos((prev) => prev.filter((p) => p.id !== id));
  }

  const pedidosFiltrados = filtro === "todos"
    ? pedidos
    : pedidos.filter((p) => p.estado === filtro);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-extrabold text-gray-900">Pedidos</h1>
        <div className="flex items-center gap-3">
          {ultimaActualiz && (
            <span className="text-xs text-gray-500">
              Actualizado: {ultimaActualiz.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => fetchPedidos()}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            ↻ Refrescar
          </button>
          <span className="text-sm text-gray-400">{pedidos.length} total</span>
        </div>
      </div>

      {/* Filtro por estado */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["todos", ...ESTADOS].map((e) => (
          <button
            key={e}
            onClick={() => setFiltro(e)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors ${
              filtro === e ? "bg-orange-500 text-black" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {e}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <FaSpinner className="text-orange-500 text-3xl animate-spin" />
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <p className="text-center text-gray-500 py-20">
          {filtro === "todos" ? "No hay pedidos todavía." : `No hay pedidos con estado "${filtro}".`}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pedidosFiltrados.map((p) => (
            <PedidoCard key={p.id} pedido={p} onEstadoChange={onEstadoChange} onEliminar={onEliminar} />
          ))}
        </div>
      )}
    </div>
  );
}
