import Link from "next/link";

import { Logo } from "@/components/layout/Logo";

const FOOTER_LINKS = [
  { href: "#instalaciones", label: "Instalaciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#editor", label: "Editor" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-paper-300/70 px-5 py-10 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-6" aria-label="Pie de página">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink-700/70 transition-colors hover:text-blueprint-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-ink-700/55">Planos de instalaciones asistidos por IA</p>
      </div>
    </footer>
  );
}
