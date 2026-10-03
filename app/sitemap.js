import { supabase } from "@/lib/supabase";

const BASE_URL = "https://www.camisetaszeus.com";

export default async function sitemap() {
  const staticRoutes = [
    { url: BASE_URL, lastModified: new Date(), priority: 1.0 },
    { url: `${BASE_URL}/catalogo`, lastModified: new Date(), priority: 0.9 },
    { url: `${BASE_URL}/kids`, lastModified: new Date(), priority: 0.8 },
    { url: `${BASE_URL}/stock`, lastModified: new Date(), priority: 0.9 },
    { url: `${BASE_URL}/mayorista`, lastModified: new Date(), priority: 0.7 },
    { url: `${BASE_URL}/guia-de-talles`, lastModified: new Date(), priority: 0.6 },
    { url: `${BASE_URL}/contacto`, lastModified: new Date(), priority: 0.5 },
  ];

  const [{ data: catalogo }, { data: stock }] = await Promise.all([
    supabase.from("productos_catalogo").select("id"),
    supabase.from("productos_stock").select("id"),
  ]);

  const catalogoRoutes = (catalogo ?? []).map((p) => ({
    url: `${BASE_URL}/catalogo/${p.id}`,
    lastModified: new Date(),
    priority: 0.8,
  }));

  const stockRoutes = (stock ?? []).map((p) => ({
    url: `${BASE_URL}/stock/${p.id}`,
    lastModified: new Date(),
    priority: 0.8,
  }));

  return [...staticRoutes, ...catalogoRoutes, ...stockRoutes];
}
