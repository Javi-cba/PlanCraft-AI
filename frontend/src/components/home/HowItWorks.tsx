const STEPS = [
  {
    step: "01",
    title: "Describí la obra",
    description:
      "Contale al asistente qué necesitás: ambientes, plantas y qué instalación querés resolver primero.",
  },
  {
    step: "02",
    title: "La IA arma el plano",
    description:
      "Ubica los símbolos sobre la planta con sus propiedades: circuitos, diámetros y consumos ya cargados.",
  },
  {
    step: "03",
    title: "Ajustá y exportá",
    description:
      "Movés, rotás o agregás lo que falte en el editor y bajás el plano en PDF, planta por planta.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="como-funciona" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-semibold tracking-[0.22em] text-timber-600 uppercase">
          De la idea al plano
        </p>
        <h2 className="mt-4 max-w-2xl font-display text-4xl leading-[1.05] font-light tracking-tight text-ink-900 sm:text-5xl">
          Cómo <span className="font-semibold text-blueprint-600">Funciona</span>
        </h2>

        <ol className="mt-12 grid gap-5 lg:mt-16 lg:grid-cols-3">
          {STEPS.map((item) => (
            <li
              key={item.step}
              className="relative overflow-hidden rounded-3xl border border-paper-300/70 bg-paper-50 p-7 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blueprint-700/5 motion-reduce:hover:translate-y-0"
            >
              <span
                aria-hidden="true"
                className="absolute top-4 right-5 font-display text-7xl leading-none font-semibold text-paper-200/90"
              >
                {item.step}
              </span>
              <div className="relative">
                <span className="text-xs font-semibold tracking-[0.18em] text-timber-600">
                  Paso {item.step}
                </span>
                <h3 className="mt-4 font-display text-2xl font-medium text-ink-900">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-700/75">{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
