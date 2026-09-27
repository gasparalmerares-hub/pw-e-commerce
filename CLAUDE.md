# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

Camisetas Zeus (camisetaszeus.com): tienda de camisetas de rugby para Argentina. Next.js 14 (App Router, JavaScript sin TypeScript), Tailwind, Supabase (base de datos), MercadoPago (pagos), Cloudinary (imágenes), Resend (mails) y Meta Pixel / Conversions API. Se despliega en Vercel: cada push a GitHub publica automáticamente. Todo el código, los textos de la interfaz y los nombres de variables y columnas están en español: mantener eso.

La dueña o el dueño de la tienda no es programador: explicar los cambios en lenguaje simple.

## Flujo de trabajo con git (obligatorio)

Hay más de una persona trabajando en este repo (la dueña o el dueño con Claude, y el programador).
- **Al empezar**, correr `git pull` para traer los cambios de otros antes de tocar nada.
- **Al terminar**, siempre hacer `git commit` y `git push` a `main`. Cada push publica automáticamente en camisetaszeus.com vía Vercel, así que conviene correr `npm run build` antes de pushear para no romper la web.

## Comandos

- `npm run dev`: servidor local en http://localhost:3000
- `npm run build` / `npm start`
- `npm run lint`: `next lint` (usa `next/core-web-vitals`; la regla `no-img-element` está desactivada a propósito)
- No hay tests automatizados.

Las variables de entorno van en `.env.local` (no se versiona). La lista completa está en `MIGRACION.md` (paso 1).

## Arquitectura

**Dos tablas de productos con reglas distintas:**
- `productos_stock` → `/stock`: envío inmediato, stock real por producto y por talle (`stock_por_talle` JSONB). Si `tipo_variante === "color"` o `seccion === "bucal"`, la variante es un color y no un talle.
- `productos_catalogo` → `/catalogo` y `/kids` (`seccion === "kids"`): se venden por encargo y **nunca descuentan stock**.
- Las rutas de admin reciben la tabla por URL (`/api/admin/productos/[tabla]`, `tabla` ∈ `stock|catalogo`) y la traducen con `nombreTabla()`.
- `data/productos.js` y `data/productosStock.js` son datos de prueba viejos que nada importa. Los productos se leen de Supabase.

Otras tablas: `pedidos`, `configuracion` (clave/valor, por ejemplo `precio_envio` y `precio_estampa`) y `paginas_especiales` (Mystery Futbox, Griptec). El esquema está repartido en varios `supabase*.sql` en la raíz, que se corren a mano en el SQL Editor de Supabase. No hay herramienta de migraciones.

**Clientes de Supabase (`lib/supabase.js`):** `supabase` usa la clave publishable y sirve para las lecturas de páginas públicas. `supabaseAdmin()` usa la service role y va **solo** en rutas de API del servidor.

**Flujo de compra:**
1. El carrito es solo del navegador (`context/CartContext.js`, se guarda en localStorage con la clave `zeus_cart`). Cada ítem guarda `tabla`, `seccion` y `descuentoTransferencia`.
2. Pago con MercadoPago: `/api/create-preference` inserta el pedido `pendiente`, crea la preferencia con `external_reference = pedido.id` y arma `notification_url` con el host de la request (MercadoPago no sigue redirecciones, así que no conviene usar `NEXT_PUBLIC_URL`).
3. `/api/webhook` verifica el pago contra la API de MercadoPago. Es idempotente gracias a `stock_descontado` y `payment_id`, y si el pedido no existe lo reconstruye. Después descuenta stock (solo de `productos_stock`), manda el evento Purchase a Meta (`lib/metaConversions.js`) y el mail de confirmación (`lib/emailConfirmacion.js`).
4. Transferencia: `/api/pedidos/transferencia` inserta el pedido `pendiente_transferencia` y, si el CHECK de la base lo rechaza, usa `pendiente` con el prefijo `[TRANSFERENCIA]` en `observaciones`. El admin lo marca `pagado` (`PATCH /api/admin/pedidos/[id]`), lo que dispara el mismo descuento de stock, el evento a Meta y el mail, una sola vez.
- La lógica de descuento de stock está **duplicada** en el webhook y en `admin/pedidos/[id]`: si se cambia, cambiarla en los dos lugares.
- Los parches o estampados se guardan como texto en `observaciones` y se cobran como ítem `estampa`. El envío es el ítem `envio`. Los dos se saltean al descontar stock.

**Admin (`/admin`, `/api/admin/*`):** `middleware.js` compara la cookie `admin_session` con `ADMIN_SESSION_SECRET`. Solo `GET /api/admin/pedidos` acepta además el header `x-api-key` (`AUTOMATION_API_KEY`), que usa el Google Apps Script del cliente. La edición de productos vive en `app/admin/_components/ProductoPanel.js`. Las subidas van a Cloudinary (`/api/admin/upload`, carpeta `productos`).

## Restricciones de costo y hosting (planes gratuitos)

- `next.config.mjs` usa `images.unoptimized: true` para no consumir transformaciones de Vercel. Las imágenes ya vienen optimizadas desde Cloudinary.
- Las imágenes tienen caché inmutable de 1 año. No agregar caché a rutas de páginas (antes dejaba páginas viejas congeladas).
- El cron de `vercel.json` llama a `/api/keepalive` una vez por día para que Supabase no pause el proyecto.
- El repo fue público: nunca hardcodear secretos (los scripts leen `.env.local`).

## Scripts (`scripts/`)

Son mantenimiento de una sola vez y se corren a mano: Python para las imágenes (compresión, quitar fondos, migración a Cloudinary) y `seed-catalogo.mjs` para cargar productos. `migrar-cloudinary.py` es un simulacro por defecto y solo cambia datos con `--ejecutar` o `--revertir`.

## Otros documentos

- `MIGRACION.md`: guía para pasar el proyecto a las cuentas del cliente, con la lista de variables de entorno.
- `PROMPTS.md`: historial de los prompts con que se construyó el sitio. No son instrucciones actuales.
