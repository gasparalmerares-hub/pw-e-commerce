"""
Migra las imágenes de Cloudinary de una cuenta a otra (entrega al cliente).

Qué hace:
  1. Busca en la base todas las URLs de la cuenta vieja de Cloudinary
     (productos de catálogo/stock y miniaturas guardadas en los pedidos).
  2. Las copia a la cuenta nueva usando "remote upload": Cloudinary se las
     baja directo de la cuenta vieja, no pasan por tu computadora.
  3. Reescribe las URLs en la base para que apunten a la cuenta nueva.

Seguridad:
  - Por defecto corre en modo SIMULACRO: muestra lo que haría y no toca nada.
  - Conserva el mismo public_id, así que es re-ejecutable: si se corta,
    se vuelve a correr y no duplica imágenes.
  - Guarda un backup con el mapeo URL vieja -> URL nueva para poder revertir.

Uso:
  Credenciales de la cuenta NUEVA (del cliente), en .env.local o como variables:
    NUEVO_CLOUDINARY_CLOUD_NAME=...
    NUEVO_CLOUDINARY_API_KEY=...
    NUEVO_CLOUDINARY_API_SECRET=...

  python3 scripts/migrar-cloudinary.py              # simulacro
  python3 scripts/migrar-cloudinary.py --ejecutar   # migra de verdad
  python3 scripts/migrar-cloudinary.py --revertir   # vuelve las URLs a la cuenta vieja
"""

import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
BACKUP = os.path.join(RAIZ, "migracion-cloudinary-backup.json")


def _env(nombre, obligatoria=True):
    """Lee una credencial de las variables de entorno o de .env.local.
    Nunca hardcodear secretos: este repo es publico."""
    v = os.environ.get(nombre)
    if v:
        return v
    try:
        with open(os.path.join(RAIZ, ".env.local")) as fh:
            for linea in fh:
                if linea.strip().startswith(nombre + "="):
                    return linea.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    if obligatoria:
        raise SystemExit(f"Falta {nombre}. Definila como variable de entorno o en .env.local")
    return None


SUPABASE_URL = _env("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = _env("SUPABASE_SERVICE_ROLE_KEY")
CLOUD_VIEJO = _env("CLOUDINARY_CLOUD_NAME")
SB = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}


# ─── Supabase ──────────────────────────────────────────────────────────────

def sb_get(ruta):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{ruta}", headers=SB)
    return json.loads(urllib.request.urlopen(req, timeout=30).read())


def sb_patch(tabla, id_, campos):
    req = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{tabla}?id=eq.{urllib.parse.quote(str(id_))}",
        data=json.dumps(campos).encode(),
        headers={**SB, "Content-Type": "application/json", "Prefer": "return=minimal"},
        method="PATCH",
    )
    urllib.request.urlopen(req, timeout=30).read()


# ─── Cloudinary ────────────────────────────────────────────────────────────

def es_de_cuenta(url, cloud):
    return isinstance(url, str) and f"res.cloudinary.com/{cloud}/" in url


def public_id_de(url):
    """Extrae el public_id (con carpeta, sin versión ni extensión) de una URL."""
    resto = url.split("/upload/", 1)[1]
    partes = resto.split("/")
    # Saltear transformaciones (contienen coma o ':') y la versión (v123...)
    i = 0
    while i < len(partes) and ("," in partes[i] or ":" in partes[i] or re.fullmatch(r"[a-z]{1,3}_[^/]+", partes[i])):
        i += 1
    if i < len(partes) and re.fullmatch(r"v\d+", partes[i]):
        i += 1
    ruta = "/".join(partes[i:])
    return re.sub(r"\.[a-zA-Z0-9]+$", "", ruta)


def subir_remoto(url_origen, public_id, cloud, key, secret):
    """Sube a la cuenta nueva pidiéndole a Cloudinary que traiga la imagen."""
    ts = str(int(time.time()))
    firmados = {"overwrite": "false", "public_id": public_id, "timestamp": ts}
    base = "&".join(f"{k}={firmados[k]}" for k in sorted(firmados))
    firma = hashlib.sha1((base + secret).encode()).hexdigest()
    cuerpo = urllib.parse.urlencode({**firmados, "file": url_origen, "api_key": key, "signature": firma}).encode()
    req = urllib.request.Request(
        f"https://api.cloudinary.com/v1_1/{cloud}/image/upload", data=cuerpo, method="POST"
    )
    try:
        res = json.loads(urllib.request.urlopen(req, timeout=90).read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode()[:300])
    return res["secure_url"]


# ─── Recolección ───────────────────────────────────────────────────────────

def recolectar(cloud):
    """Devuelve (urls_unicas, filas) de todo lo que apunta a `cloud`."""
    urls, filas = set(), []

    for tabla in ["productos_catalogo", "productos_stock"]:
        for p in sb_get(f"{tabla}?select=id,nombre,imagen,imagen_espalda,imagenes_extra"):
            encontradas = [u for u in [p.get("imagen"), p.get("imagen_espalda")] + (p.get("imagenes_extra") or [])
                           if es_de_cuenta(u, cloud)]
            if encontradas:
                urls.update(encontradas)
                filas.append((tabla, p))

    for ped in sb_get("pedidos?select=id,items"):
        items = ped.get("items") or []
        encontradas = [i.get("imagen") for i in items if es_de_cuenta(i.get("imagen"), cloud)]
        if encontradas:
            urls.update(encontradas)
            filas.append(("pedidos", ped))

    return sorted(urls), filas


def reescribir(filas, mapeo):
    """Aplica el mapeo URL vieja -> URL nueva a todas las filas afectadas."""
    m = lambda u: mapeo.get(u, u)
    actualizadas = 0
    for tabla, fila in filas:
        if tabla == "pedidos":
            nuevos = [{**i, "imagen": m(i.get("imagen"))} for i in (fila.get("items") or [])]
            if nuevos != fila.get("items"):
                sb_patch(tabla, fila["id"], {"items": nuevos})
                actualizadas += 1
        else:
            campos = {}
            for c in ["imagen", "imagen_espalda"]:
                if fila.get(c) and m(fila[c]) != fila[c]:
                    campos[c] = m(fila[c])
            extras = fila.get("imagenes_extra") or []
            nuevas_extras = [m(u) for u in extras]
            if nuevas_extras != extras:
                campos["imagenes_extra"] = nuevas_extras
            if campos:
                sb_patch(tabla, fila["id"], campos)
                actualizadas += 1
    return actualizadas


# ─── Modos ─────────────────────────────────────────────────────────────────

def simulacro():
    urls, filas = recolectar(CLOUD_VIEJO)
    por_tabla = {}
    for t, _ in filas:
        por_tabla[t] = por_tabla.get(t, 0) + 1

    print(f"SIMULACRO — no se modifica nada\n")
    print(f"Cuenta vieja: {CLOUD_VIEJO}")
    nuevo = _env("NUEVO_CLOUDINARY_CLOUD_NAME", obligatoria=False)
    print(f"Cuenta nueva: {nuevo or '(todavía no configurada)'}\n")
    print(f"Imágenes a copiar: {len(urls)}")
    for t, n in por_tabla.items():
        print(f"  filas a actualizar en {t}: {n}")

    print("\nMuestra (public_id que se conserva):")
    for u in urls[:5]:
        print(f"  {public_id_de(u)}")

    rotas = []
    print("\nVerificando que las imágenes originales sean accesibles...")
    for u in urls:
        try:
            urllib.request.urlopen(urllib.request.Request(u, method="HEAD"), timeout=20)
        except Exception:
            rotas.append(u)
    print(f"  accesibles: {len(urls) - len(rotas)}/{len(urls)}")
    for u in rotas:
        print(f"  NO accesible: {u}")

    print("\nPara migrar de verdad: python3 scripts/migrar-cloudinary.py --ejecutar")


def ejecutar():
    cloud = _env("NUEVO_CLOUDINARY_CLOUD_NAME")
    key = _env("NUEVO_CLOUDINARY_API_KEY")
    secret = _env("NUEVO_CLOUDINARY_API_SECRET")
    if cloud == CLOUD_VIEJO:
        raise SystemExit("La cuenta nueva es igual a la vieja. Revisá NUEVO_CLOUDINARY_CLOUD_NAME.")

    urls, filas = recolectar(CLOUD_VIEJO)
    print(f"Copiando {len(urls)} imágenes de '{CLOUD_VIEJO}' a '{cloud}'...\n")

    mapeo, errores = {}, []
    if os.path.exists(BACKUP):
        mapeo = json.load(open(BACKUP)).get("mapeo", {})

    for n, u in enumerate(urls, 1):
        if u in mapeo:
            continue
        try:
            mapeo[u] = subir_remoto(u, public_id_de(u), cloud, key, secret)
            print(f"  [{n}/{len(urls)}] ok  {public_id_de(u)}")
        except Exception as e:
            errores.append((u, str(e)))
            print(f"  [{n}/{len(urls)}] ERROR {public_id_de(u)}: {e}")
        # Backup incremental: si se corta, no se pierde lo avanzado
        json.dump({"cloud_viejo": CLOUD_VIEJO, "cloud_nuevo": cloud, "mapeo": mapeo},
                  open(BACKUP, "w"), indent=2)

    if errores:
        print(f"\n{len(errores)} imágenes fallaron. NO se tocó la base.")
        print("Volvé a correr el script: retoma desde donde quedó.")
        sys.exit(1)

    print(f"\nTodas copiadas. Actualizando la base...")
    n = reescribir(filas, mapeo)
    print(f"  filas actualizadas: {n}")

    restantes, _ = recolectar(CLOUD_VIEJO)
    print(f"\nURLs que todavía apuntan a '{CLOUD_VIEJO}': {len(restantes)}")
    print(f"Backup del mapeo: {BACKUP}")
    print("\nÚltimo paso: cambiar CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET en Vercel y redeployar.")


def revertir():
    if not os.path.exists(BACKUP):
        raise SystemExit("No hay backup para revertir.")
    datos = json.load(open(BACKUP))
    inverso = {nueva: vieja for vieja, nueva in datos["mapeo"].items()}
    _, filas = recolectar(datos["cloud_nuevo"])
    n = reescribir(filas, inverso)
    print(f"Revertidas {n} filas a la cuenta '{datos['cloud_viejo']}'.")


if __name__ == "__main__":
    if "--ejecutar" in sys.argv:
        ejecutar()
    elif "--revertir" in sys.argv:
        revertir()
    else:
        simulacro()
