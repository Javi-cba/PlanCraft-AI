import Link from "next/link";

import { FloatingModel } from "@/components/ui/FloatingModel";

/** Where a lost visitor can plausibly want to go from here. */
const EXITS = [
  { href: "/#instalaciones", label: "Instalaciones" },
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#editor", label: "El editor" },
] as const;

export default function NotFound() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid-paper text-blueprint-600 [mask-image:linear-gradient(to_bottom,black,transparent_90%)]"
      />

      <section className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pt-12 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-x-6 lg:gap-y-8 lg:pt-16 lg:pb-28">
        <div className="animate-rise motion-reduce:animate-none lg:col-start-1 lg:row-start-1">
          <p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">
            Error 404 · Todavía no pusimos ni los cimientos por acá.
          </p>

          <h1 className="mt-5 font-display text-5xl leading-[0.95] font-medium tracking-tight text-ink-900 sm:text-6xl">
            Esta Planta
            <span className="mt-1 block font-semibold text-blueprint-600">No Existe</span>
          </h1>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-blueprint-600 px-7 py-3.5 text-sm font-medium text-paper-50 shadow-lg shadow-blueprint-600/20 transition hover:-translate-y-0.5 hover:bg-blueprint-700 motion-reduce:hover:translate-y-0"
            >
              Volver al inicio
            </Link>
          </div>

        </div>

        <div className="relative lg:-mr-6 xl:-mr-10">
          {/* The digits belong to the render, so the frame only echoes them. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 -top-4 text-center font-display text-[9rem] leading-none font-semibold text-paper-200/85 select-none sm:text-[11rem] lg:-top-8 lg:text-[12rem]"
          >
            404
          </span>
          <FloatingModel
            src="/404-3d.png"
            alt="Maqueta 3D de una losa agrietada con una escalera que no llega a ninguna parte"
            width={1018}
            height={578}
            sizes="(min-width: 1024px) 52vw, 92vw"
            priority
            maxTilt={7}
            className="relative"
          />
        </div>

        <div className="border-t border-paper-300/70 pt-6 lg:col-start-1 lg:row-start-2 lg:self-start">
          <p className="text-[0.7rem] font-semibold tracking-[0.14em] text-ink-700/55 uppercase">
            Salidas de obra
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {EXITS.map((exit) => (
              <li key={exit.href}>
                <Link
                  href={exit.href}
                  className="text-sm text-ink-700/80 underline decoration-timber-400/60 decoration-2 underline-offset-4 transition-colors hover:text-blueprint-600"
                >
                  {exit.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
