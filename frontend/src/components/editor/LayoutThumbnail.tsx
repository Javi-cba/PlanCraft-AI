import { layoutBounds, openingsOfWall, solidSegments, pointOnWall } from "@/lib/geometry/layout";
import type { Layout } from "@/lib/schemas/layout";

/**
 * A small SVG of a layout, drawn from the layout itself.
 *
 * Template cards and floor cards both need a preview, and a hand-drawn one
 * would be a second copy of the plan to keep in sync. This one cannot drift:
 * it is the same walls, viewBoxed to fit.
 */
export function LayoutThumbnail({
  layout,
  className,
  label,
}: {
  layout: Layout;
  className?: string;
  /** Describes the plan for screen readers. Omit for a purely decorative one. */
  label?: string;
}) {
  const bounds = layoutBounds(layout);

  if (bounds === null) {
    return (
      <svg
        viewBox="0 0 120 80"
        className={className}
        role={label ? "img" : "presentation"}
        aria-label={label}
      >
        <rect
          x="8"
          y="8"
          width="104"
          height="64"
          rx="6"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.28"
          strokeWidth="2"
          strokeDasharray="6 5"
        />
      </svg>
    );
  }

  // A margin of one tenth of the drawing keeps the walls off the edge at any
  // size, which a fixed number of units would not.
  const width = Math.max(bounds.maxX - bounds.minX, 1);
  const height = Math.max(bounds.maxY - bounds.minY, 1);
  const margin = Math.max(width, height) * 0.08;

  const viewBox = [
    bounds.minX - margin,
    bounds.minY - margin,
    width + margin * 2,
    height + margin * 2,
  ].join(" ");

  // Strokes are in plan units, so they have to scale with the drawing.
  const stroke = Math.max(width, height) * 0.018;

  return (
    <svg
      viewBox={viewBox}
      className={className}
      role={label ? "img" : "presentation"}
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
    >
      <g fill="currentColor" fillOpacity="0.08">
        {layout.rooms.map((room) => (
          <polygon
            key={room.id}
            points={room.points.map((point) => `${point.x},${point.y}`).join(" ")}
          />
        ))}
      </g>

      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
      >
        {layout.walls.flatMap((wall) =>
          solidSegments(wall, openingsOfWall(layout, wall.id)).map(([from, to], index) => {
            const a = pointOnWall(wall, from);
            const b = pointOnWall(wall, to);

            return (
              <line
                key={`${wall.id}-${index}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
              />
            );
          }),
        )}
      </g>
    </svg>
  );
}
