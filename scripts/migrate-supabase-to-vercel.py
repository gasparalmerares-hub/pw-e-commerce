"""
Migra las imagenes que estan en Supabase Storage al directorio /public/productos/
de Vercel, y actualiza las URLs en las tablas productos_catalogo / productos_stock.

Resultado:
- Supabase Storage egress baja a ~0
- Las imagenes se sirven desde Vercel (100GB free, vs 5GB en Supabase)
- Las URLs en la web pasan de https://...supabase.co/... a /productos/...
"""

import io
import json
import os
import urllib.request
from pathlib import Path

import os as _os

def _env(nombre):
    """Lee una credencial de las variables de entorno o de .env.local.
    Nunca hardcodear secretos: este repo es publico."""
    v = _os.environ.get(nombre)
    if v:
        return v
    ruta = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", ".env.local")
    try:
        with open(ruta) as fh:
            for linea in fh:
                if linea.strip().startswith(nombre + "="):
                    return linea.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    raise SystemExit(f"Falta {nombre}. Definila como variable de entorno o en .env.local")



SUPABASE_URL = _env("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")

HEADERS = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}

PUBLIC_DIR = Path("/Users/segundo/Desktop/pw-e-commerce/public/productos")
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)


def supabase_filename(url):
    if "/storage/v1/object/public/productos/" not in url:
        return None
    return url.split("/storage/v1/object/public/productos/")[-1]


def is_supabase(url):
    return "supabase.co" in (url or "") and "/storage/v1/object/public/productos/" in url


def download(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def fetch_productos(tabla):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{tabla}?select=id,imagen,imagen_espalda,imagenes_extra",
        headers=HEADERS,
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def update_producto(tabla, id_, campos):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{tabla}?id=eq.{id_}",
        data=json.dumps(campos).encode(),
        headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
        method="PATCH",
    )
    with urllib.request.urlopen(req) as r:
        r.read()


def remap(url, cache):
    """Devuelve la nueva URL local. Descarga y guarda el archivo si no esta."""
    if not is_supabase(url):
        return url
    if url in cache:
        return cache[url]

    filename = supabase_filename(url)
    if not filename:
        return url

    local_path = PUBLIC_DIR / filename
    if not local_path.exists():
        try:
            data = download(url)
            local_path.write_bytes(data)
            print(f"  descargada: {filename} ({len(data)//1024}KB)")
        except Exception as e:
            print(f"  ERROR descargando {filename}: {e}")
            return url

    nueva_url = f"/productos/{filename}"
    cache[url] = nueva_url
    return nueva_url


def main():
    cache = {}
    total_actualizados = 0

    for tabla in ["productos_catalogo", "productos_stock"]:
        productos = fetch_productos(tabla)
        print(f"\n=== {tabla}: {len(productos)} productos ===")

        for i, p in enumerate(productos):
            cambios = {}

            for campo in ["imagen", "imagen_espalda"]:
                url = p.get(campo)
                if is_supabase(url):
                    nueva = remap(url, cache)
                    if nueva != url:
                        cambios[campo] = nueva

            extras = p.get("imagenes_extra") or []
            nuevas_extras = [remap(u, cache) for u in extras]
            if nuevas_extras != extras:
                cambios["imagenes_extra"] = nuevas_extras

            if cambios:
                update_producto(tabla, p["id"], cambios)
                total_actualizados += 1
                print(f"[{i+1}/{len(productos)}] actualizado producto {p['id']}")

    print(f"\n--- LISTO ---")
    print(f"Descargadas: {len(cache)} imagenes unicas")
    print(f"Productos actualizados: {total_actualizados}")
    print(f"Directorio: {PUBLIC_DIR}")


if __name__ == "__main__":
    main()
