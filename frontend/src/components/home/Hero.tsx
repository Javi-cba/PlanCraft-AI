import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

import { FloatingModel } from "@/components/ui/FloatingModel";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Plan paper behind the whole hero, fading out downwards. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid-paper text-blueprint-600 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pt-14 pb-16 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.28fr)] lg:gap-x-6 lg:gap-y-10 lg:pt-16 lg:pb-24">
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:-mr-16 lg:self-center xl:-mr-24 2xl:-mr-32">
          <FloatingModel
            src="/house-3d.png"
            alt="Maqueta 3D de una casa de dos plantas usada como referencia de proyecto"
            width={1800}
            height={983}
            sizes="(min-width: 1024px) 55vw, 92vw"
            priority
          />
        </div>

        <div className="animate-rise motion-reduce:animate-none lg:col-start-1 lg:row-start-1">
          <p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">
            Planos de instalación con IA
          </p>

          <h1 className="mt-5 font-display text-5xl leading-[0.95] font-medium tracking-tight text-ink-900 sm:text-6xl 2xl:text-7xl">
            Diseñá Tu
            <span className="mt-1 block font-semibold text-blueprint-600">Espacio Perfecto</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-700/80 sm:text-lg">
            Describí la obra en una frase y PlanCraft arma los planos de instalación. Ajustá cada
            símbolo en el editor, planta por planta, y exportá el plano listo para presentar.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal" forceRedirectUrl="/projects">
                <button className="rounded-full bg-blueprint-600 px-7 py-3.5 text-sm font-medium text-paper-50 shadow-lg shadow-blueprint-600/20 transition hover:-translate-y-0.5 hover:bg-blueprint-700 motion-reduce:hover:translate-y-0">
                  Empezar gratis
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/projects"
                className="rounded-full bg-blueprint-600 px-7 py-3.5 text-sm font-medium text-paper-50 shadow-lg shadow-blueprint-600/20 transition hover:-translate-y-0.5 hover:bg-blueprint-700 motion-reduce:hover:translate-y-0"
              >
                Ir a mis proyectos
              </Link>
            </Show>

            <Link
              href="#como-funciona"
              className="rounded-full border border-blueprint-600/25 px-7 py-3.5 text-sm font-medium text-blueprint-700 transition hover:border-blueprint-600/60 hover:bg-paper-50"
            >
              Cómo funciona
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
