// Solo servidor (usa supabaseAdmin): lo llaman las rutas que crean el pedido
// real (Mercado Pago y transferencia) para borrar el carrito abandonado que
// la web había guardado mientras la persona completaba sus datos.

import { supabaseAdmin } from "@/lib/supabase";
import { MARCA_CARRITO } from "@/lib/carritos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function borrarCarrito(id) {
  if (!UUID_RE.test(id ?? "")) return;
  try {
    await supabaseAdmin().from("pedidos").delete()
      .eq("id", id).eq("estado", "pendiente").like("observaciones", `${MARCA_CARRITO}%`);
  } catch (err) {
    console.error("[carritos] No se pudo borrar:", err?.message);
  }
}
