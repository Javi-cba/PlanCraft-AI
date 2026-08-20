import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

import { PlanPreview, type PlanVariant } from "@/components/home/PlanPreview";

const INSTALLATIONS: {
  variant: PlanVariant;
  title: string;
  description: string;
  symbols: string[];
}[] = [
  {
    variant: "electrical",
    title: "Eléctrica",
    description:
      "Circuitos, tableros y consumos por ambiente. Cada símbolo guarda su potencia y el circuito al que pertenece.",
    symbols: ["Tomas", "Llaves", "Luminarias", "Tablero"],
  },
  {
    variant: "sanitary",
    title: "Sanitaria",
    description:
      "Alimentación y descarga con los diámetros de cada tramo, artefactos ubicados y cámaras de inspección.",
    symbols: ["Cañerías", "Artefactos", "Descargas", "Cámaras"],
  },
  {
    variant: "gas",
    title: "Gas",
    description:
      "Recorrido desde el medidor hasta cada artefacto, con el consumo declarado tramo por tramo.",
    symbols: ["Medidor", "Cañerías", "Artefactos", "Ventilaciones"],
  },
];

export function Installations() {
  return (
    <section id="instalaciones" className="px-3 pb-6 sm:px-5">
      <div className="relative overflow-hidden rounded-[2rem] bg-ink-900 px-5 py-16 sm:rounded-[2.5rem] sm:px-10 lg:px-14 lg:py-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid-paper-fine text-paper-50 opacity-70"
        />

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.22em] text-timber-400 uppercase">
                Lo que genera la IA
              </p>
              <h2 className="mt-4 max-w-2xl font-display text-4xl leading-[1.05] font-light tracking-tight text-paper-50 sm:text-5xl lg:text-6xl">
                Tres Instalaciones,{" "}
                <span className="font-semibold">Un Mismo Plano</span>
              </h2>
            </div>

            <div id="editor" className="shrink-0 scroll-mt-28">
              <Show when="signed-out">
                <SignInButton mode="modal" forceRedirectUrl="/projects">
                  <button className="rounded-full bg-paper-50 px-7 py-3.5 text-xs font-semibold tracking-[0.12em] text-ink-900 uppercase transition hover:bg-timber-300">
                    Probar el editor
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/projects"
                  className="block rounded-full bg-paper-50 px-7 py-3.5 text-xs font-semibold tracking-[0.12em] text-ink-900 uppercase transition hover:bg-timber-300"
                >
                  Abrir el editor
                </Link>
              </Show>
            </div>
          </div>

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3">
            {INSTALLATIONS.map((item) => (
              <li
                key={item.variant}
                className="group flex flex-col overflow-hidden rounded-3xl border border-paper-50/10 bg-ink-800/80 transition-colors hover:border-timber-400/40"
              >
                <div className="border-b border-paper-50/10 bg-ink-700/40 p-5">
                  <PlanPreview variant={item.variant} />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-2xl font-medium text-paper-50">{item.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-paper-200/70">
                    {item.description}
                  </p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {item.symbols.map((symbol) => (
                      <li
                        key={symbol}
                        className="rounded-full border border-paper-50/12 px-3 py-1 text-xs text-paper-200/75"
                      >
                        {symbol}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
