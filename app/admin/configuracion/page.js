"use client";

import { useState, useEffect } from "react";
import { FaSpinner, FaSave } from "react-icons/fa";
import { PROVINCIAS, parsePreciosProvincias } from "@/lib/envio";

// Normaliza { provincia: "12000" } → string JSON estable, sin provincias vacías
function serializarProvincias(obj) {
  const limpio = {};
  for (const p of PROVINCIAS) {
    const n = parseInt(obj?.[p]);
    if (Number.isFinite(n) && n > 0) limpio[p] = n;
  }
  return JSON.stringify(limpio);
}

const inputClass =
  "bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:border-orange-500 transition-colors w-full";

export default function ConfiguracionPage() {
  const [precioEnvio,     setPrecioEnvio]     = useState("");
  const [precioEnvioDB,   setPrecioEnvioDB]   = useState(null);
  const [precioEstampa,   setPrecioEstampa]   = useState("");
  const [precioEstampaDB, setPrecioEstampaDB] = useState(null);
  const [preciosProv,     setPreciosProv]     = useState({});
  const [preciosProvDB,   setPreciosProvDB]   = useState(null);
  const [stockMayorista,  setStockMayorista]  = useState(false);
  const [stockMayoristaDB, setStockMayoristaDB] = useState(null);
  const [metaMayoristas,  setMetaMayoristas]  = useState(false);
  const [metaMayoristasDB, setMetaMayoristasDB] = useState(null);
  const [cargando,        setCargando]        = useState(true);
  const [guardando,       setGuardando]       = useState(false);
  const [guardado,        setGuardado]        = useState(false);
  const [error,           setError]           = useState(null);

  async function cargarDesdeDB() {
    const res = await fetch(`/api/admin/config?t=${Date.now()}`, { cache: "no-store" });
    const d = await res.json();
    if (d.error) { setError(d.error); return null; }
    const envio   = d.precio_envio ?? "";
    const estampa = d.precio_estampa ?? "";
    setPrecioEnvio(envio);
    setPrecioEnvioDB(envio);
    setPrecioEstampa(estampa);
    setPrecioEstampaDB(estampa);
    const provincias = serializarProvincias(parsePreciosProvincias(d.precio_envio_provincias));
    setPreciosProv(JSON.parse(provincias));
    setPreciosProvDB(provincias);
    const mayoristas = d.meta_mayoristas === "si";
    setMetaMayoristas(mayoristas);
    setMetaMayoristasDB(mayoristas);
    const stockPublico = d.mayorista_stock_publico === "si";
    setStockMayorista(stockPublico);
    setStockMayoristaDB(stockPublico);
    return { envio, estampa, provincias, mayoristas, stockPublico };
  }

  useEffect(() => {
    cargarDesdeDB().finally(() => setCargando(false));
  }, []);

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    setGuardado(false);

    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        precio_envio: precioEnvio,
        precio_estampa: precioEstampa,
        precio_envio_provincias: serializarProvincias(preciosProv),
        meta_mayoristas: metaMayoristas ? "si" : "no",
        mayorista_stock_publico: stockMayorista ? "si" : "no",
      }),
    });

    if (res.ok) {
      const esperadoProv = serializarProvincias(preciosProv);
      const enDB = await cargarDesdeDB();
      if (enDB && enDB.envio === String(precioEnvio) && enDB.estampa === String(precioEstampa) && enDB.provincias === esperadoProv && enDB.mayoristas === metaMayoristas && enDB.stockPublico === stockMayorista) {
        setGuardado(true);
        setTimeout(() => setGuardado(false), 3000);
      } else {
        setError("Hubo un problema al guardar. Revisá los logs del servidor.");
      }
    } else {
      const d = await res.json();
      setError(d.error ?? "Error al guardar");
    }
    setGuardando(false);
  }

  const sinGuardarEnvio   = precioEnvioDB   !== null && String(precioEnvio)   !== String(precioEnvioDB);
  const sinGuardarEstampa = precioEstampaDB !== null && String(precioEstampa) !== String(precioEstampaDB);
  const sinGuardarProv    = preciosProvDB   !== null && serializarProvincias(preciosProv) !== preciosProvDB;
  const sinGuardarMeta    = metaMayoristasDB !== null && metaMayoristas !== metaMayoristasDB;
  const sinGuardarStock   = stockMayoristaDB !== null && stockMayorista !== stockMayoristaDB;

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-6">Configuración</h1>

      {cargando ? (
        <div className="flex items-center justify-center py-20">
          <FaSpinner className="text-orange-500 text-3xl animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleGuardar} className="max-w-md flex flex-col gap-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-gray-900">Envío</h2>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Precio de envío general (ARS)</label>
              <input
                type="number"
                min="0"
                value={precioEnvio}
                onChange={(e) => setPrecioEnvio(e.target.value)}
                placeholder="9000"
                className={inputClass}
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor guardado: <strong className={sinGuardarEnvio ? "text-yellow-600" : "text-green-700"}>${precioEnvioDB ?? "—"}</strong>
                {sinGuardarEnvio && <span className="text-yellow-600 ml-2">· cambios sin guardar</span>}
              </p>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-200 pt-4">
              <label className="text-xs text-gray-600 font-semibold">
                Precio por provincia (ARS)
                {sinGuardarProv && <span className="text-yellow-600 font-normal ml-2">· cambios sin guardar</span>}
              </label>
              <p className="text-xs text-gray-500">
                Dejá vacía una provincia para que use el precio general{precioEnvio ? ` ($${precioEnvio})` : ""}.
              </p>
              <div className="flex flex-col gap-1.5">
                {PROVINCIAS.map((p) => (
                  <div key={p} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-gray-700 truncate">{p}</span>
                    <input
                      type="number"
                      min="0"
                      value={preciosProv[p] ?? ""}
                      onChange={(e) => setPreciosProv((prev) => ({ ...prev, [p]: e.target.value }))}
                      placeholder={precioEnvio || "—"}
                      className={`${inputClass} !w-32 text-right`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-base font-bold text-gray-900">Estampa</h2>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-600">Precio de estampa / parche estampado (ARS)</label>
              <input
                type="number"
                min="0"
                value={precioEstampa}
                onChange={(e) => setPrecioEstampa(e.target.value)}
                placeholder="5000"
                className={inputClass}
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor guardado: <strong className={sinGuardarEstampa ? "text-yellow-600" : "text-green-700"}>${precioEstampaDB ?? "—"}</strong>
                {sinGuardarEstampa && <span className="text-yellow-600 ml-2">· cambios sin guardar</span>}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-3">
            <h2 className="text-base font-bold text-gray-900">Mayorista</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={stockMayorista}
                onChange={(e) => setStockMayorista(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-orange-500 shrink-0"
              />
              <span className="text-sm text-gray-700">
                Mostrar <strong>Mayorista Stock</strong> al público
                <span className="block text-xs text-gray-500 mt-0.5">
                  Apagado: en la sección Mayorista solo se ve Pedido a medida. Podés probar Stock igual entrando a /mayorista#stock.
                </span>
              </span>
            </label>
            {sinGuardarStock && <p className="text-xs text-yellow-600">· cambios sin guardar</p>}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col gap-3">
            <h2 className="text-base font-bold text-gray-900">Meta (Facebook e Instagram)</h2>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={metaMayoristas}
                onChange={(e) => setMetaMayoristas(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-orange-500 shrink-0"
              />
              <span className="text-sm text-gray-700">
                Enviar las ventas <strong>mayoristas</strong> a Meta
                <span className="block text-xs text-gray-500 mt-0.5">
                  Apagado: Meta recibe solo las ventas minoristas, así las métricas de tus anuncios no se mezclan con los pedidos mayoristas.
                </span>
              </span>
            </label>
            {sinGuardarMeta && <p className="text-xs text-yellow-600">· cambios sin guardar</p>}
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={guardando}
            className="flex items-center justify-center gap-2 bg-orange-500 text-black font-bold py-3 rounded-xl hover:bg-orange-400 transition-colors disabled:opacity-50"
          >
            <FaSave />
            {guardando ? "Guardando..." : guardado ? "¡Guardado!" : "Guardar cambios"}
          </button>
        </form>
      )}
    </div>
  );
}
