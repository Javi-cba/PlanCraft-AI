import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

export function CtaBand() {
  return (
    <section className="px-3 pb-16 sm:px-5">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-blueprint-600 px-6 py-14 text-center sm:rounded-[2.5rem] sm:px-10 lg:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid-paper text-paper-50 opacity-60"
        />

        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-3xl leading-tight font-light tracking-tight text-paper-50 sm:text-4xl lg:text-5xl">
            Tu próximo plano <span className="font-semibold">empieza con una frase</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-paper-100/80 sm:text-base">
            Creá un proyecto, sumá las plantas y dejá que la IA proponga la instalación. Vos tenés la
            última palabra sobre cada símbolo.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Show when="signed-out">
              <SignInButton mode="modal" forceRedirectUrl="/projects">
                <button className="rounded-full bg-paper-50 px-7 py-3.5 text-sm font-medium text-blueprint-700 transition hover:bg-timber-300">
                  Crear mi primer plano
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/projects"
                className="rounded-full bg-paper-50 px-7 py-3.5 text-sm font-medium text-blueprint-700 transition hover:bg-timber-300"
              >
                Ir a mis proyectos
              </Link>
            </Show>
            <Link
              href="#instalaciones"
              className="rounded-full border border-paper-50/30 px-7 py-3.5 text-sm font-medium text-paper-50 transition hover:border-paper-50/70"
            >
              Ver instalaciones
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
