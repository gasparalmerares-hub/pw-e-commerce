# Migración de Camisetas Zeus a las cuentas del cliente

Guía para pasar la tienda de las cuentas del desarrollador a las del cliente.
Seguí los pasos **en orden**: algunos dependen de los anteriores.

## Qué se migra y qué no

| Servicio | Acción | Cómo |
|---|---|---|
| Supabase (base de datos) | Transferir | Nativo, desde el panel |
| Cloudinary (105 fotos) | Migrar | Script `scripts/migrar-cloudinary.py` |
| Vercel (hosting) | Proyecto nuevo del cliente | Importar el repo (Hobby no permite transferir) |
| Dominio `camisetaszeus.com` | Apuntar al proyecto nuevo | Ver paso 6 |
| GitHub (repo) | Transferir | Nativo, desde el panel |
| MercadoPago | Nada | Ya es del cliente |
| Resend | Nada | Ya es del cliente |
| Meta Pixel | Nada | Ya es del cliente |

Las 200 fotos que están en `public/` viven dentro del repo y viajan solas.

---

## Paso 0 — Urgente, antes que nada

La clave `service_role` de Supabase estuvo expuesta en el repo público
desde el 13/05. Sacarla del código no la borra del historial de git.

- [ ] Supabase → Project Settings → **API Keys** → rotar la `service_role` / secret key
- [ ] Actualizar `SUPABASE_SERVICE_ROLE_KEY` en Vercel (y la publishable si también cambió)
- [ ] Actualizar el mismo valor en tu `.env.local` (el script de Cloudinary lo usa)
- [ ] **Redeploy** en Vercel
- [ ] GitHub → repo → Settings → cambiar a **Private**

## Paso 1 — Guardar todas las variables

En Vercel las variables marcadas como *Sensitive* no se pueden volver a leer.
Antes de mover nada, asegurate de tener cada valor guardado en un lugar seguro.

| Variable | Dónde está |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` (la nueva, del paso 0) |
| `MP_ACCESS_TOKEN` | `.env.local` |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | Cambian en el paso 3 |
| `ADMIN_USER` / `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` | `.env.local` |
| `AUTOMATION_API_KEY` | `.env.local` |
| `NEXT_PUBLIC_META_PIXEL_ID` | `1080698547833683` |
| `NEXT_PUBLIC_URL` | `https://camisetaszeus.com` (sin www) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Cuenta de Resend del cliente |
| `META_CONVERSIONS_TOKEN` | Meta del cliente (solo si se usa) |
| `CRON_SECRET` | Opcional |

## Paso 2 — Supabase

La transferencia **conserva la misma URL y las mismas claves**: no hay que
tocar Vercel ni el código.

- [ ] El cliente crea su cuenta en supabase.com y una organización
- [ ] El cliente te invita a esa organización como **Owner**
- [ ] Vos: Project Settings → General → **Transfer project** → elegir la org del cliente
- [ ] Verificar que la web siga cargando productos
- [ ] Salir de la organización del cliente

En el plan gratuito una organización admite 2 proyectos activos.

## Paso 3 — Cloudinary

- [ ] El cliente crea su cuenta en cloudinary.com
- [ ] Te pasa: **Cloud name**, **API Key** y **API Secret** (Dashboard, arriba)
- [ ] Los agregás a tu `.env.local`:
  ```
  NUEVO_CLOUDINARY_CLOUD_NAME=...
  NUEVO_CLOUDINARY_API_KEY=...
  NUEVO_CLOUDINARY_API_SECRET=...
  ```
- [ ] Simulacro (no toca nada, confirmá que muestre la cuenta nueva):
  ```bash
  python3 scripts/migrar-cloudinary.py
  ```
- [ ] Migración real:
  ```bash
  python3 scripts/migrar-cloudinary.py --ejecutar
  ```
  Al terminar tiene que decir: `URLs que todavía apuntan a 'duhjutir3': 0`
- [ ] En Vercel, cambiar `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y
      `CLOUDINARY_API_SECRET` por los del cliente → **Redeploy**
- [ ] Revisar en la web que las fotos se vean
- [ ] Subir una foto de prueba desde el admin y confirmar que va a la cuenta del cliente

**Si algo falla:**
- Si falla alguna imagen, la base no se modifica. Volvé a correr `--ejecutar`: sigue donde quedó.
- Para deshacer: `python3 scripts/migrar-cloudinary.py --revertir`
- **No borres tu cuenta de Cloudinary** hasta confirmar que todo se ve bien.

## Paso 4 — GitHub

Vercel Hobby no permite transferir proyectos entre cuentas gratuitas (solo a
equipos, que son Pro). El cliente va a importar el repo en su propio Vercel,
así que el repo tiene que estar en su cuenta **personal** de GitHub (no en
una organización).

- [ ] GitHub → repo → Settings → **Transfer ownership** → usuario del cliente
- [ ] El cliente acepta la transferencia
- [ ] Si vas a seguir haciendo cambios: que te agregue como **colaborador**

## Paso 5 — Vercel (proyecto nuevo del cliente)

- [ ] El cliente: Vercel → **Add New → Project** → importar `pw-e-commerce`
- [ ] **Antes de Deploy**, cargar todas las variables del paso 1
      (con los valores nuevos de Cloudinary del paso 3)
- [ ] Deploy
- [ ] Probar en la URL `*.vercel.app` que asigna Vercel: fotos, login del
      admin, subir una foto. La web real sigue andando desde el proyecto
      viejo mientras tanto.
- [ ] Verificar que el cron `/api/keepalive` aparezca en Settings → Cron Jobs

## Paso 6 — Dominio

`camisetaszeus.com` se compró a través de Vercel, así que el registro está en
la cuenta del desarrollador. Hacerlo en un horario tranquilo: puede haber
unos minutos de corte.

- [ ] Proyecto **viejo**: Settings → Domains → quitar `camisetaszeus.com`
- [ ] Proyecto **del cliente**: Settings → Domains → agregar `camisetaszeus.com`
- [ ] Vercel pide verificarlo con un registro TXT: agregarlo desde la cuenta
      donde está el DNS del dominio (la del desarrollador)
- [ ] Confirmar que `camisetaszeus.com` cargue desde el proyecto nuevo
- [ ] Pausar o borrar el proyecto viejo

MercadoPago (webhook), Supabase y Resend siguen funcionando sin cambios
porque dependen del dominio, no del proyecto de Vercel.

**Registro del dominio:** sigue en la cuenta del desarrollador. Para
entregarlo del todo hay que moverlo aparte. Si se deja vencer para que el
cliente lo compre, hay riesgo de que otro lo compre primero; coordinar para
que lo compre el mismo día. En el DNS están los registros de **Resend**
(`resend._domainkey`, `send` MX y TXT, `_dmarc`): si el DNS cambia de cuenta
hay que volver a cargarlos y re-verificar en Resend.

## Paso 7 — El cliente rota los secretos

El desarrollador conoce todas las claves. Una vez entregado, el cliente debería cambiar:

- [ ] `ADMIN_PASSWORD` y `ADMIN_SESSION_SECRET` (acceso al panel)
- [ ] `AUTOMATION_API_KEY` (nueva con `openssl rand -hex 32`), y actualizarla en su Google Apps Script
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (se rota desde Supabase)
- [ ] **Redeploy** después de cambiarlas

## Paso 8 — Verificación final

- [ ] La home, el catálogo, niños y stock cargan con fotos
- [ ] El login del admin funciona
- [ ] Subir un producto con foto desde el admin
- [ ] Compra de prueba con MercadoPago: aparece como **pagado** en el panel
- [ ] Llega el mail de confirmación al comprador
- [ ] Marcar una transferencia como pagada: descuenta stock y manda el mail
- [ ] El Excel del cliente trae los pedidos con la API key nueva
- [ ] Meta Events Manager recibe `PageView` en el pixel `1080698547833683`
