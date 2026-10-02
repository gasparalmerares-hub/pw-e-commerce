// Sección en prueba: no aparece en el menú ni en el sitemap, y se le pide a
// los buscadores que no la indexen hasta que esté lista.
export const metadata = {
  title: "Mayorista | Camisetas Zeus",
  description: "Compra mayorista de camisetas de rugby en stock. Precios en dólares por cantidad.",
  robots: { index: false, follow: false },
};
export default function Layout({ children }) { return children; }
