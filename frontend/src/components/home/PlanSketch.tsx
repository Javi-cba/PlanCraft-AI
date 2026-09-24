/**
 * The floor plan the assistant transcript on the home page produces: a 12 × 9 m
 * house of 108 m² with three bedrooms, kitchen, bathroom and living-dining.
 *
 * Drawn as SVG for the same reason as `PlanPreview`: it is the language the
 * editor speaks, and there is no screenshot to keep in sync. One unit is 5 cm,
 * so every measurement the chat quotes is the one drawn here — the partition
 * leaves exactly 150 cm free, the new window is 120 cm wide, and every room
 * opens onto the corridor, which is what the assistant's own rules demand.
 */
export function PlanSketch() {
  return (
    <svg
      viewBox="0 0 280 220"
      role="img"
      aria-label="Planta baja de 108 m² con sala de estar, comedor, tres dormitorios, cocina, baño y pasillo. El tabique entre la sala y el comedor y la ventana del comedor están resaltados como el último cambio del asistente."
      className="h-auto w-full"
    >
      <defs>
        <pattern id="plan-sketch-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </pattern>
      </defs>

      <g className="text-blueprint-600/12">
        <rect x="20" y="20" width="240" height="180" fill="url(#plan-sketch-grid)" />
      </g>

      {/* Shell and corridor first, then the partitions that hang off them. */}
      <g
        className="text-ink-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="square"
      >
        <path d="M20 20h240v180H20z" />
        <path d="M20 120h240" />
      </g>
      <g
        className="text-ink-900"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="square"
      >
        <path d="M160 20v100" />
        <path d="M84 140h176" />
        <path d="M84 120v80M124 140v60M192 140v60" />
      </g>

      {/* Windows: a gap punched in the wall, with its sill line. */}
      <g className="text-timber-500" fill="none" stroke="currentColor">
        <g stroke="var(--color-paper-50)" strokeWidth="4.4">
          {WINDOWS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g strokeWidth="1.5" strokeLinecap="round">
          {WINDOWS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </g>

      {/* Doors: the gap, the leaf, and the swing it needs to clear. */}
      <g className="text-timber-500">
        {DOORS.map((door) => (
          <Door key={`${door.x}-${door.y}-${door.open}`} {...door} />
        ))}
      </g>

      {/* What the last message added: the partition and the dining-room window. */}
      <g className="text-blueprint-500" fill="none" stroke="currentColor">
        <g strokeWidth="8" strokeOpacity="0.16" strokeLinecap="round">
          <path d="M100 50v70M115 20h24" />
        </g>
        <path d="M100 50v70" strokeWidth="2.6" strokeLinecap="square" />
        <path d="M115 20h24" stroke="var(--color-paper-50)" strokeWidth="4.4" />
        <path d="M115 20h24" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      <g className="text-blueprint-600" fill="currentColor">
        <g
          fill="var(--color-paper-50)"
          stroke="currentColor"
          strokeWidth="0.7"
          strokeOpacity="0.35"
        >
          <rect x="60" y="38" width="34" height="11" rx="5.5" />
          <rect x="108" y="4" width="38" height="11" rx="5.5" />
        </g>
        <text x="77" y="45.8" textAnchor="middle" fontSize="6" fontWeight="600">
          + tabique
        </text>
        <text x="127" y="11.8" textAnchor="middle" fontSize="6" fontWeight="600">
          + ventana
        </text>
      </g>

      {/* Room names and areas, as the editor labels them. */}
      <g className="text-ink-800" fill="currentColor" textAnchor="middle">
        {ROOMS.map((room) => (
          <g key={room.name}>
            <text x={room.x} y={room.y} fontSize="6" fontWeight="500">
              {room.name}
            </text>
            {room.area ? (
              <text x={room.x} y={room.y + 7} fontSize="5" fillOpacity="0.55">
                {room.area}
              </text>
            ) : null}
          </g>
        ))}
      </g>
    </svg>
  );
}

/**
 * One door: hinge at (x, y), leaf `w` long. `open` is where the leaf ends up
 * when the door is open and `along` is the wall it sits on — together they set
 * which way the swing curves.
 */
type Dir = "up" | "down" | "left" | "right";

function Door({ x, y, w, open, along }: { x: number; y: number; w: number; open: Dir; along: Dir }) {
  const [ox, oy] = STEP[open];
  const [ax, ay] = STEP[along];
  const leafX = x + ox * w;
  const leafY = y + oy * w;
  const shutX = x + ax * w;
  const shutY = y + ay * w;
  // With +y pointing down, a positive cross product turns clockwise on screen,
  // which is SVG's sweep flag 1.
  const sweep = ox * ay - oy * ax > 0 ? 1 : 0;

  return (
    <g fill="none" stroke="currentColor">
      {/* Punch the opening out of the wall underneath. */}
      <path d={`M${x} ${y}L${shutX} ${shutY}`} stroke="var(--color-paper-50)" strokeWidth="4.4" />
      <path
        d={`M${leafX} ${leafY}A${w} ${w} 0 0 ${sweep} ${shutX} ${shutY}`}
        strokeWidth="1.1"
        strokeDasharray="2 2"
        strokeOpacity="0.7"
      />
      <path d={`M${x} ${y}L${leafX} ${leafY}`} strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

const STEP: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

const WINDOWS = [
  "M45 20h24", // Sala de estar
  "M190 20h24", // Dormitorio 1
  "M260 45v20", // Dormitorio 1, lateral
  "M38 200h24", // Cocina
  "M96 200h12", // Baño
  "M146 200h24", // Dormitorio 2
  "M214 200h24", // Dormitorio 3
];

const DOORS: { x: number; y: number; w: number; open: Dir; along: Dir }[] = [
  { x: 20, y: 60, w: 18, open: "right", along: "down" }, // entrada
  { x: 50, y: 120, w: 18, open: "down", along: "right" }, // sala ↔ cocina
  { x: 120, y: 120, w: 18, open: "down", along: "right" }, // comedor ↔ pasillo
  { x: 218, y: 120, w: 18, open: "down", along: "left" }, // dormitorio 1 ↔ pasillo
  { x: 84, y: 150, w: 16, open: "left", along: "down" }, // cocina ↔ pasillo
  { x: 96, y: 140, w: 14, open: "down", along: "right" }, // baño
  { x: 145, y: 140, w: 18, open: "down", along: "right" }, // dormitorio 2
  { x: 233, y: 140, w: 18, open: "down", along: "left" }, // dormitorio 3
];

const ROOMS: { name: string; x: number; y: number; area?: string }[] = [
  { name: "Sala de estar", x: 60, y: 68, area: "20,0 m²" },
  { name: "Comedor", x: 130, y: 68, area: "15,0 m²" },
  { name: "Dormitorio 1", x: 210, y: 68, area: "25,0 m²" },
  { name: "Cocina", x: 52, y: 166, area: "12,8 m²" },
  { name: "Pasillo", x: 172, y: 132 },
  { name: "Baño", x: 104, y: 168, area: "6,0 m²" },
  { name: "Dormitorio 2", x: 158, y: 168, area: "10,2 m²" },
  { name: "Dormitorio 3", x: 226, y: 168, area: "10,2 m²" },
];
