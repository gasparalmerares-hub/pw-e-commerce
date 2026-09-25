"""
Procesa imágenes que están en Supabase Storage (subidas desde el admin):
- Descarga cada imagen
- Remueve el fondo con rembg
- Convierte a WebP
- Re-sube a Supabase Storage con nuevo nombre
- Actualiza las URLs en las tablas productos_catalogo / productos_stock
"""

import io
import json
import urllib.request
import urllib.parse
from rembg import remove
from PIL import Image
import time
import random

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


def fetch_productos(tabla):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{tabla}?select=id,imagen,imagen_espalda,imagenes_extra",
        headers=HEADERS,
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def download(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def upload_to_storage(blob_bytes, filename):
    """Sube un archivo al bucket 'productos' y devuelve la URL pública."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/productos/{filename}",
        data=blob_bytes,
        headers={**HEADERS, "Content-Type": "image/webp"},
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        r.read()
    return f"{SUPABASE_URL}/storage/v1/object/public/productos/{filename}"


def process_image(url):
    """Descarga, remueve fondo, convierte a WebP. Devuelve bytes."""
    img_bytes = download(url)
    sin_fondo = remove(img_bytes)
    img = Image.open(io.BytesIO(sin_fondo))
    out = io.BytesIO()
    img.save(out, "WEBP", quality=85, method=6)
    return out.getvalue()


def update_producto(tabla, id_, campos):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{tabla}?id=eq.{id_}",
        data=json.dumps(campos).encode(),
        headers={**HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"},
        method="PATCH",
    )
    with urllib.request.urlopen(req) as r:
        r.read()


def main():
    cache = {}  # url_original -> url_nueva

    for tabla in ["productos_catalogo", "productos_stock"]:
        productos = fetch_productos(tabla)
        print(f"\n=== {tabla}: {len(productos)} productos ===")

        for i, p in enumerate(productos):
            cambios = {}

            # imagen y imagen_espalda
            for campo in ["imagen", "imagen_espalda"]:
                url = p.get(campo)
                if not url or "supabase.co" not in url:
                    continue

                if url in cache:
                    cambios[campo] = cache[url]
                    continue

                try:
                    print(f"  [{i+1}/{len(productos)}] {campo}: procesando...")
                    nuevos_bytes = process_image(url)
                    nuevo_nombre = f"{int(time.time()*1000)}-{random.randint(1000,9999)}-sf.webp"
                    nueva_url = upload_to_storage(nuevos_bytes, nuevo_nombre)
                    cache[url] = nueva_url
                    cambios[campo] = nueva_url
                    print(f"    -> {len(nuevos_bytes)//1024}KB")
                except Exception as e:
                    print(f"    ERROR: {e}")

            # imagenes_extra (array)
            extras_originales = p.get("imagenes_extra") or []
            extras_nuevas = []
            for url in extras_originales:
                if "supabase.co" not in url:
                    extras_nuevas.append(url)
                    continue
                if url in cache:
                    extras_nuevas.append(cache[url])
                    continue
                try:
                    print(f"  [{i+1}/{len(productos)}] extra: procesando...")
                    nuevos_bytes = process_image(url)
                    nuevo_nombre = f"{int(time.time()*1000)}-{random.randint(1000,9999)}-sf.webp"
                    nueva_url = upload_to_storage(nuevos_bytes, nuevo_nombre)
                    cache[url] = nueva_url
                    extras_nuevas.append(nueva_url)
                except Exception as e:
                    print(f"    ERROR: {e}")
                    extras_nuevas.append(url)

            if extras_nuevas != extras_originales:
                cambios["imagenes_extra"] = extras_nuevas

            if cambios:
                update_producto(tabla, p["id"], cambios)

    print(f"\nProcesadas {len(cache)} imágenes únicas")


if __name__ == "__main__":
    main()
