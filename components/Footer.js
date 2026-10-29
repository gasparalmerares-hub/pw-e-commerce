import Link from "next/link";
import { FaInstagram, FaWhatsapp } from "react-icons/fa";
import { FaTiktok } from "react-icons/fa6";

const enlaces = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/kids", label: "Niños" },
  { href: "/stock", label: "Stock" },
  { href: "/mayorista", label: "Mayorista" },
  { href: "/guia-de-talles", label: "Guía de Talles" },
  { href: "/contacto", label: "Contacto" },
];

export default function Footer() {
  return (
    <footer className="w-full bg-[#ece9e3] text-gray-900 border-t border-gray-200 py-10 md:py-16">
      <div className="max-w-5xl mx-auto px-4 md:px-8">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-start text-left">

          {/* Left column: brand */}
          <div className="flex flex-col gap-3 items-start">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold uppercase tracking-widest text-gray-500">
                Camisetas Zeus
              </span>
            </div>
            <a
              href="https://www.google.com/maps/place/La+Plata,+Buenos+Aires"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-gray-500 hover:text-orange-400 transition-colors"
            >
              La Plata, Buenos Aires
            </a>
            <p className="text-sm text-gray-500">Envíos a todo el país</p>
            <p className="text-sm text-gray-500">Transferencia · Tarjeta de credito y debito · Mercado Pago</p>
          </div>

          {/* Middle column: links */}
          <div className="flex flex-col gap-3 items-start md:items-center">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-1">
              Enlaces
            </p>
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="inline-block text-sm text-gray-500 hover:text-orange-400 transition-colors"
              >
                {e.label}
              </Link>
            ))}
          </div>

          {/* Right column: social */}
          <div className="flex flex-col gap-3 items-start md:items-end">
            <p className="text-sm uppercase tracking-widest text-gray-500 mb-1">
              Seguinos
            </p>
            <a
              href="https://instagram.com/camisetaszeus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-orange-400 transition-colors"
            >
              <span className="w-5 flex justify-center shrink-0"><FaInstagram className="text-xl" /></span>
              @camisetaszeus
            </a>
            <a
              href="https://tiktok.com/@camisetaszeus8"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-orange-400 transition-colors"
            >
              <span className="w-5 flex justify-center shrink-0"><FaTiktok className="text-xl" /></span>
              @camisetaszeus
            </a>
            <a
              href="https://wa.me/5492216220145"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-orange-400 transition-colors"
            >
              <span className="w-5 flex justify-center shrink-0"><FaWhatsapp className="text-xl" /></span>
              WhatsApp
            </a>
          </div>

        </div>

        {/* Orange divider + bottom bar */}
        <div className="border-t border-orange-500 mt-12 pt-6 flex flex-col items-center gap-1 text-center">
          <p className="text-sm text-gray-500">© 2026 Camisetas Zeus</p>
          <a
            href="https://instagram.com/koda.git"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-gray-400 hover:text-orange-400 transition-colors"
          >
            Sitio web desarrollado por koda
          </a>
        </div>

      </div>
    </footer>
  );
}
