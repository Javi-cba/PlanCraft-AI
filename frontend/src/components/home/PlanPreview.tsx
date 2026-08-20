export type PlanVariant = "electrical" | "sanitary" | "gas";

/**
 * A small hand-drawn plan per installation type. Drawn as SVG on purpose: the
 * symbols are the same language the editor speaks, and there is no screenshot
 * to keep in sync.
 */
export function PlanPreview({ variant }: { variant: PlanVariant }) {
  return (
    <svg
      viewBox="0 0 320 190"
      role="img"
      aria-label={LABELS[variant]}
      className="h-auto w-full text-paper-200"
    >
      {/* Grid, then the shell every variant is drawn on. */}
      <defs>
        <pattern id={`grid-${variant}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="320" height="190" fill={`url(#grid-${variant})`} />

      <g fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="3" strokeLinejoin="round">
        <path d="M18 22h284v146H18z" />
        <path d="M186 22v66M186 122v46" />
        <path d="M18 122h168" />
      </g>

      {VARIANTS[variant]}
    </svg>
  );
}

const LABELS: Record<PlanVariant, string> = {
  electrical: "Plano de instalación eléctrica con tomas, llaves y luminarias",
  sanitary: "Plano de instalación sanitaria con cañerías, artefactos y descarga",
  gas: "Plano de instalación de gas con medidor, cañería y artefactos",
};

const VARIANTS: Record<PlanVariant, React.ReactNode> = {
  electrical: (
    <g className="text-timber-300">
      {/* Circuit run, then outlets, a switch and two ceiling lights. */}
      <path
        d="M40 150h74l36-44h96"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="7 6"
        strokeOpacity="0.75"
      />
      <g stroke="currentColor" strokeWidth="2.5" fill="none">
        <circle cx="40" cy="150" r="7" />
        <path d="M40 143v-9" />
        <circle cx="114" cy="150" r="7" />
        <path d="M114 143v-9" />
        <circle cx="246" cy="106" r="7" />
        <path d="M246 99v-9" />
      </g>
      <g stroke="currentColor" strokeWidth="2.5" fill="none">
        <circle cx="96" cy="70" r="10" />
        <path d="M89 63l14 14M103 63l-14 14" />
        <circle cx="248" cy="58" r="10" />
        <path d="M241 51l14 14M255 51l-14 14" />
      </g>
      <g stroke="currentColor" strokeWidth="2.5" fill="none">
        <circle cx="160" cy="150" r="5" />
        <path d="M164 146l9-9" />
      </g>
    </g>
  ),
  sanitary: (
    <g className="text-timber-300">
      {/* Supply run in a continuous line, plus the fixtures it feeds. */}
      <path
        d="M44 62h84v72h132"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeOpacity="0.8"
        strokeLinecap="round"
      />
      <g stroke="currentColor" strokeWidth="2.5" fill="none">
        {/* Inspection chamber. */}
        <circle cx="260" cy="134" r="11" />
        <circle cx="260" cy="134" r="4.5" />
        {/* WC. */}
        <rect x="34" y="40" width="30" height="22" rx="8" />
        {/* Sink. */}
        <rect x="112" y="96" width="34" height="24" rx="5" />
        <circle cx="129" cy="108" r="4" />
        {/* Shower tray. */}
        <rect x="222" y="40" width="46" height="40" rx="4" />
        <path d="M232 50l26 20M258 50l-26 20" strokeOpacity="0.6" strokeWidth="2" />
      </g>
    </g>
  ),
  gas: (
    <g className="text-timber-300">
      {/* Metered supply, then the appliances on the run. */}
      <path
        d="M34 150h96v-46h114"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="14 7"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
      <g stroke="currentColor" strokeWidth="2.5" fill="none">
        {/* Meter. */}
        <rect x="22" y="136" width="26" height="28" rx="5" />
        <circle cx="35" cy="150" r="6" />
        <path d="M35 150l4-4" />
        {/* Cooker with four burners. */}
        <rect x="102" y="52" width="46" height="40" rx="5" />
        <g fill="currentColor" stroke="none">
          <circle cx="115" cy="65" r="4" />
          <circle cx="135" cy="65" r="4" />
          <circle cx="115" cy="80" r="4" />
          <circle cx="135" cy="80" r="4" />
        </g>
        {/* Water heater. */}
        <rect x="228" y="86" width="34" height="38" rx="14" />
        <path d="M245 96v18" strokeOpacity="0.7" />
      </g>
    </g>
  ),
};
