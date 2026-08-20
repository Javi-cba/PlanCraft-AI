import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { Logo } from "@/components/layout/Logo";

const NAV_LINKS = [
  { href: "/", label: "Inicio" },
  { href: "#instalaciones", label: "Instalaciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#editor", label: "Editor" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-paper-200/70 bg-paper-100/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:h-20">
        <Link href="/" className="shrink-0" aria-label="PlanCraft AI, inicio">
          <Logo />
        </Link>

        {/* The links are decorative until those routes exist, so they are
            anchors into this page rather than dead route links. */}
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Principal">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-ink-700/80 transition-colors hover:text-blueprint-600"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/projects">
              <button className="rounded-full bg-blueprint-600 px-5 py-2.5 text-sm font-medium text-paper-50 shadow-sm transition-colors hover:bg-blueprint-700 sm:px-6">
                Iniciar sesión
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/projects"
              className="hidden rounded-full bg-blueprint-600 px-5 py-2.5 text-sm font-medium text-paper-50 transition-colors hover:bg-blueprint-700 sm:block"
            >
              Mis proyectos
            </Link>
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
