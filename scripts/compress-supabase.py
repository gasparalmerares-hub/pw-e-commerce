"""
Comprime las imagenes que ya estan en Supabase Storage:
- Descarga cada una
- Redimensiona a max 1200px de ancho
- Recomprime a WebP quality 75
- Sube de vuelta con el mismo nombre (upsert) para no romper URLs en la DB
- Las URLs en productos_catalogo / productos_stock quedan igual
"""

import io
import json
import urllib.request
from PIL import Image

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

MAX_WIDTH = 1200
QUALITY   = 75


def fetch_urls():
    """Obtiene todas las URLs unicas de Supabase Storage desde la DB."""
    urls = set()
    for tabla in ["productos_catalogo", "productos_stock"]:
        req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/{tabla}?select=imagen,imagen_espalda,imagenes_extra",
            headers=HEADERS,
        )
        with urllib.request.urlopen(req) as r:
            productos = json.loads(r.read())
        for p in productos:
            for campo in ["imagen", "imagen_espalda"]:
                if p.get(campo): urls.add(p[campo])
            for u in (p.get("imagenes_extra") or []):
                urls.add(u)
    return [u for u in urls if "supabase.co" in u and "/storage/v1/object/public/productos/" in u]


def filename_from_url(url):
    return url.split("/productos/")[-1]


def download(url):
    with urllib.request.urlopen(url) as r:
        return r.read()


def upload_overwrite(filename, blob_bytes):
    """Sube reemplazando el archivo existente (upsert)."""
    req = urllib.request.Request(
        f"{SUPABASE_URL}/storage/v1/object/productos/{filename}",
        data=blob_bytes,
        headers={
            **HEADERS,
            "Content-Type": "image/webp",
            "x-upsert": "true",
            "Cache-Control": "public, max-age=31536000, immutable",
        },
        method="PUT",
    )
    with urllib.request.urlopen(req) as r:
        r.read()


def compress(img_bytes):
    img = Image.open(io.BytesIO(img_bytes))

    # Convertir RGBA a RGB con fondo blanco si tiene transparencia (mantenemos
    # el alpha en WebP, pero PIL a veces tiene problemas con modos raros).
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        # WebP soporta transparencia, mantenemos RGBA
        if img.mode != "RGBA":
            img = img.convert("RGBA")
    else:
        img = img.convert("RGB")

    # Redimensionar si es muy grande
    if img.width > MAX_WIDTH:
        ratio = MAX_WIDTH / img.width
        nuevo_alto = int(img.height * ratio)
        img = img.resize((MAX_WIDTH, nuevo_alto), Image.LANCZOS)

    out = io.BytesIO()
    img.save(out, "WEBP", quality=QUALITY, method=6)
    return out.getvalue()


def main():
    urls = fetch_urls()
    print(f"Encontradas {len(urls)} imagenes en Supabase Storage\n")

    total_antes  = 0
    total_despues = 0
    procesadas = 0

    for i, url in enumerate(urls):
        try:
            filename = filename_from_url(url)
            original = download(url)
            antes = len(original)

            comprimida = compress(original)
            despues = len(comprimida)

            # Si la "comprimida" es mas grande o igual, no la subimos
            if despues >= antes:
                print(f"[{i+1}/{len(urls)}] {filename}: ya esta optimizada ({antes//1024}KB), salteando")
                continue

            upload_overwrite(filename, comprimida)
            total_antes  += antes
            total_despues += despues
            procesadas += 1
            print(f"[{i+1}/{len(urls)}] {filename}: {antes//1024}KB -> {despues//1024}KB ({100 - despues*100//antes}% menos)")
        except Exception as e:
            print(f"[{i+1}/{len(urls)}] ERROR en {url}: {e}")

    if procesadas > 0:
        print(f"\n--- TOTAL ---")
        print(f"Antes:    {total_antes/1024/1024:.1f} MB")
        print(f"Despues:  {total_despues/1024/1024:.1f} MB")
        print(f"Ahorrado: {(total_antes - total_despues)/1024/1024:.1f} MB ({100 - total_despues*100//total_antes}%)")
        print(f"Procesadas: {procesadas}/{len(urls)}")


if __name__ == "__main__":
    main()
