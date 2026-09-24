import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";

import { PlanSketch } from "@/components/home/PlanSketch";

/**
 * Marketing section for the assistant: a small transcript on the left and the
 * drawing it produced on the right.
 *
 * Everything here is static on purpose — the copy is the same the real panel
 * writes and the plan is the SVG twin of the layout those messages describe, so
 * the section never has to be kept in sync with a screenshot.
 */

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; applied: string };

const TURNS: Turn[] = [
  {
    role: "user",
    text: "Una casa de tres dormitorios, cocina, baño y living comedor.",
  },
  {
    role: "assistant",
    text: "Dibujé 108 m²: living comedor al frente, tres dormitorios y el baño sobre el pasillo. Paredes exteriores de 20 cm e interiores de 12.",
    applied: "24 cambios aplicados",
  },
  {
    role: "user",
    text: "Dividí la sala del comedor con un tabique a media longitud y sumale una ventana al comedor.",
  },
  {
    role: "assistant",
    text: "Puse un tabique de 12 cm que arranca de la pared de abajo y deja 150 cm libres arriba, así los dos ambientes quedan comunicados, más una ventana de 120 cm sobre la pared de arriba.",
    applied: "2 cambios aplicados",
  },
];

const SUGGESTIONS = [
  "Agrandá el baño 50 cm hacia el pasillo.",
  "Agregale una ventana a cada dormitorio.",
  "Sumá una planta alta con dos dormitorios y baño.",
];

const GUARANTEES = [
  {
    title: "Toca solo lo que pediste",
    description:
      "Un retoque es un retoque: no vuelve a dibujar la casa ni te pisa lo que moviste a mano.",
  },
  {
    title: "Sabe de medidas reales",
    description:
      "Pared exterior 20 cm, dormitorio 300×350, puerta de baño 70. Toda habitación con puerta y ventana a exterior.",
  },
  {
    title: "Nada se aplica a medias",
    description:
      "Cada operación se valida sola. Si una sale mal se descarta esa, te dice por qué, y las demás entran igual.",
  },
  {
    title: "Guardás vos",
    description:
      "El resultado cae en el lienzo y en tu pila de undo. Lo revisás, ⌘Z si no te gustó, y recién ahí guardás.",
  },
];

export function AiShowcase() {
  return (
    <section id="asistente" className="relative scroll-mt-24 overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid-paper text-blueprint-600 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
        <p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">
          Asistente IA
        </p>
        <h2 className="mt-4 max-w-3xl font-display text-4xl leading-[1.05] font-light tracking-tight text-ink-900 sm:text-5xl">
          Describilo en una frase,{" "}
          <span className="font-semibold text-blueprint-600">se dibuja solo</span>
        </h2>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-700/80">
          No es un chat que te explica cómo dibujar. Es un asistente que mueve las paredes: cada
          respuesta llega como cambios sobre el plano que estás mirando.
        </p>

        <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <ChatPanel />
          <PlanPanel />
        </div>

        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {GUARANTEES.map((item) => (
            <li
              key={item.title}
              className="rounded-3xl border border-paper-300/70 bg-paper-50 p-6 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blueprint-700/5 motion-reduce:hover:translate-y-0"
            >
              <h3 className="font-display text-lg font-medium text-ink-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-700/75">{item.description}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal" forceRedirectUrl="/projects">
              <button className="rounded-full bg-blueprint-600 px-7 py-3.5 text-sm font-medium text-paper-50 shadow-lg shadow-blueprint-600/20 transition hover:-translate-y-0.5 hover:bg-blueprint-700 motion-reduce:hover:translate-y-0">
                Dibujar mi primer plano
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/projects"
              className="rounded-full bg-blueprint-600 px-7 py-3.5 text-sm font-medium text-paper-50 shadow-lg shadow-blueprint-600/20 transition hover:-translate-y-0.5 hover:bg-blueprint-700 motion-reduce:hover:translate-y-0"
            >
              Dibujar mi primer plano
            </Link>
          </Show>
          <Link
            href="#instalaciones"
            className="rounded-full border border-blueprint-600/25 px-7 py-3.5 text-sm font-medium text-blueprint-700 transition hover:border-blueprint-600/60 hover:bg-paper-50"
          >
            Ver las instalaciones
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The assistant panel of the editor, shrunk to a still. */
function ChatPanel() {
  return (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-paper-300/70 bg-paper-50 shadow-xl shadow-blueprint-700/5">
      <div className="flex items-center gap-3 border-b border-paper-300/70 px-5 py-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-blueprint-600/10 text-blueprint-600">
          <SparkIcon />
        </span>
        <div>
          <p className="font-display text-sm font-medium text-ink-900">Asistente IA</p>
          <p className="text-xs text-ink-700/60">anthropic/claude-sonnet-5</p>
        </div>
      </div>

      <ol className="flex flex-col gap-4 px-5 py-6">
        {TURNS.map((turn, index) =>
          turn.role === "user" ? (
            <li key={index} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-ink-900 px-4 py-3 text-sm leading-relaxed text-paper-50">
                {turn.text}
              </p>
            </li>
          ) : (
            <li key={index} className="flex justify-start">
              <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-paper-300/70 bg-paper-100/70 px-4 py-3">
                <p className="text-sm leading-relaxed text-ink-800">{turn.text}</p>
                <p className="mt-2 text-[0.6875rem] font-semibold tracking-[0.12em] text-timber-600 uppercase">
                  {turn.applied}
                </p>
              </div>
            </li>
          ),
        )}
      </ol>

      <div className="mt-auto border-t border-paper-300/70 px-5 py-5">
        <ul className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <li
              key={suggestion}
              className="rounded-full border border-paper-300/70 bg-paper-100/60 px-3 py-1.5 text-xs text-ink-700/75"
            >
              {suggestion}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-paper-300/70 bg-paper-100/50 py-3 pr-3 pl-4">
          <span className="flex-1 text-sm text-ink-700/45">
            Describí el plano o el cambio que querés…
          </span>
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blueprint-600/10 text-blueprint-600"
          >
            <SendIcon />
          </span>
        </div>
      </div>
    </div>
  );
}

/** The canvas side: the drawing those two messages produced. */
function PlanPanel() {
  return (
    <div className="overflow-hidden rounded-3xl border border-paper-300/70 bg-paper-50 shadow-xl shadow-blueprint-700/5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-300/70 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="rounded-md bg-ink-900 px-2 py-1 text-[0.625rem] font-semibold tracking-[0.08em] text-paper-50">
            PB
          </span>
          <p className="font-display text-sm font-medium text-ink-900">Planta Baja</p>
        </div>
        <ul className="flex gap-2">
          {[
            ["Paredes", "11"],
            ["Aberturas", "15"],
            ["Ambientes", "8"],
          ].map(([label, value]) => (
            <li
              key={label}
              className="rounded-lg border border-paper-300/70 px-2.5 py-1 text-center"
            >
              <span className="block text-[0.5625rem] tracking-[0.1em] text-ink-700/55 uppercase">
                {label}
              </span>
              <span className="block font-display text-sm font-semibold text-ink-900">{value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-4 sm:p-6">
        <PlanSketch />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-paper-300/70 px-5 py-4 text-xs text-ink-700/70">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-blueprint-500" />
          Lo que agregó el último pedido
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-timber-400" />
          Puertas y ventanas
        </span>
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 12l16-8-6 8 6 8-16-8z" />
    </svg>
  );
}
