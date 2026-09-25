"""
Procesa todas las imágenes de /public/catalogo/ removiendo el fondo
y guardándolas como WebP optimizado en el mismo lugar.
Luego actualiza las URLs en Supabase de .jpg -> .webp
"""

import os
import io
import sys
from pathlib import Path
from rembg import remove
from PIL import Image
import urllib.request
import json

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

INPUT_DIR = Path("/Users/segundo/Desktop/pw-e-commerce/public/catalogo")

def process_images():
    files = sorted(INPUT_DIR.glob("*.jpg"))
    print(f"Encontradas {len(files)} imágenes JPG\n")

    total_before = 0
    total_after = 0

    for i, file in enumerate(files):
        output_path = file.with_suffix(".webp")

        if output_path.exists():
            print(f"[{i+1}/{len(files)}] {file.name} - ya existe, salteando")
            continue

        try:
            with open(file, "rb") as f:
                input_data = f.read()

            output_data = remove(input_data)
            img = Image.open(io.BytesIO(output_data))
            img.save(output_path, "WEBP", quality=85, method=6)

            size_before = file.stat().st_size
            size_after = output_path.stat().st_size
            total_before += size_before
            total_after += size_after

            print(f"[{i+1}/{len(files)}] {file.name}: {size_before//1024}KB -> {output_path.name}: {size_after//1024}KB")
        except Exception as e:
            print(f"[{i+1}/{len(files)}] ERROR en {file.name}: {e}")

    print(f"\n--- TOTAL ---")
    print(f"Antes: {total_before//1024//1024}MB")
    print(f"Despues: {total_after//1024//1024}MB")


def update_supabase():
    """Actualiza las URLs de .jpg a .webp en productos_catalogo."""
    print("\n--- Actualizando Supabase ---")

    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    # Traer todos los productos del catálogo
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/productos_catalogo?select=id,imagen,imagen_espalda,imagenes_extra",
        headers=headers,
    )
    with urllib.request.urlopen(req) as r:
        productos = json.loads(r.read())

    print(f"Encontrados {len(productos)} productos en catálogo")

    actualizados = 0
    for p in productos:
        updates = {}
        if p.get("imagen") and p["imagen"].endswith(".jpg") and "/catalogo/" in p["imagen"]:
            updates["imagen"] = p["imagen"].replace(".jpg", ".webp")
        if p.get("imagen_espalda") and p["imagen_espalda"].endswith(".jpg") and "/catalogo/" in p["imagen_espalda"]:
            updates["imagen_espalda"] = p["imagen_espalda"].replace(".jpg", ".webp")
        if p.get("imagenes_extra"):
            nuevas_extra = [
                u.replace(".jpg", ".webp") if u.endswith(".jpg") and "/catalogo/" in u else u
                for u in p["imagenes_extra"]
            ]
            if nuevas_extra != p["imagenes_extra"]:
                updates["imagenes_extra"] = nuevas_extra

        if not updates:
            continue

        patch_req = urllib.request.Request(
            f"{SUPABASE_URL}/rest/v1/productos_catalogo?id=eq.{p['id']}",
            data=json.dumps(updates).encode(),
            headers=headers,
            method="PATCH",
        )
        try:
            with urllib.request.urlopen(patch_req) as r:
                actualizados += 1
        except Exception as e:
            print(f"ERROR actualizando {p['id']}: {e}")

    print(f"Actualizados {actualizados} productos\n")


if __name__ == "__main__":
    if "--skip-process" not in sys.argv:
        process_images()
    if "--skip-update" not in sys.argv:
        update_supabase()
    print("Listo!")
