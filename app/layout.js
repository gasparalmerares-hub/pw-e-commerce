import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ProgressBar from "@/components/ProgressBar";
import MetaPixel from "@/components/MetaPixel";
import TikTokPixel from "@/components/TikTokPixel";
import { CartProvider } from "@/context/CartContext";

export const metadata = {
  title: "Camisetas Zeus | Camisetas de Rugby Argentina",
  description: "Las mejores camisetas de rugby de Argentina. Stock disponible y pedidos por encargo. Envíos a todo el país.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      // Favicon adaptativo: negro para fondo claro, blanco para modo oscuro
      { url: "/logo-negro-cuadrado.png" },
      { url: "/logo-negro-cuadrado.png", media: "(prefers-color-scheme: light)" },
      { url: "/logo-blanco-cuadrado.png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/logo-negro-cuadrado.png",
  },
  openGraph: {
    title: "Camisetas Zeus | Camisetas de Rugby Argentina",
    description: "Las mejores camisetas de rugby de Argentina. Stock disponible y pedidos por encargo.",
    siteName: "Camisetas Zeus",
    locale: "es_AR",
    type: "website",
  },
};

export const viewport = {
  themeColor: "#f97316",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-[#f5f5f0] text-gray-900 antialiased">
        <MetaPixel />
        <TikTokPixel />
        <CartProvider>
          <ProgressBar />
          <Navbar />
          <main>{children}</main>
          <Footer />
        </CartProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
