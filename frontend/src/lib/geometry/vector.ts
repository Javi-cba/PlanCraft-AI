import type { Point } from "@/lib/schemas/layout";

/** Pure point maths on the plan plane. No layout knowledge, no canvas, no JSX. */

export function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtract(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(point: Point, factor: number): Point {
  return { x: point.x * factor, y: point.y * factor };
}

export function length(point: Point): number {
  return Math.hypot(point.x, point.y);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Point at `t` along the segment: 0 is `a`, 1 is `b`. */
export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Unit vector from `a` to `b`. Returns `{0,0}` for a degenerate segment. */
export function direction(a: Point, b: Point): Point {
  const delta = subtract(b, a);
  const size = length(delta);
  return size === 0 ? { x: 0, y: 0 } : scale(delta, 1 / size);
}

/** The unit vector turned 90°, i.e. the normal of the segment. */
export function perpendicular(unit: Point): Point {
  return { x: -unit.y, y: unit.x };
}

/** Radians of `a → b`, measured from the +x axis with +y pointing down. */
export function angle(a: Point, b: Point): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rounds to a multiple of `step`. `step <= 0` disables the snap. */
export function snapValue(value: number, step: number): number {
  return step > 0 ? Math.round(value / step) * step : value;
}

export function snapPoint(point: Point, step: number): Point {
  return { x: snapValue(point.x, step), y: snapValue(point.y, step) };
}

/**
 * Projection of `point` onto the segment `a→b`, clamped to it.
 *
 * `t` is where it landed (0 at `a`, 1 at `b`) and `distance` how far the point
 * was — which is what turns "click near a wall" into "this wall, right here".
 */
export function projectOnSegment(
  point: Point,
  a: Point,
  b: Point,
): { t: number; point: Point; distance: number } {
  const delta = subtract(b, a);
  const squared = delta.x * delta.x + delta.y * delta.y;

  if (squared === 0) return { t: 0, point: a, distance: distance(point, a) };

  const raw = ((point.x - a.x) * delta.x + (point.y - a.y) * delta.y) / squared;
  const t = clamp(raw, 0, 1);
  const projected = lerp(a, b, t);

  return { t, point: projected, distance: distance(point, projected) };
}

/**
 * Constrains `to` so the segment from `from` runs at a multiple of `stepDeg`.
 *
 * Floor plans are overwhelmingly orthogonal, so this is on by default in the
 * editor: it keeps a wall square without asking anyone to aim.
 */
export function constrainToAngle(from: Point, to: Point, stepDeg = 45): Point {
  const delta = subtract(to, from);
  const size = length(delta);
  if (size === 0) return to;

  const step = (stepDeg * Math.PI) / 180;
  const snapped = Math.round(Math.atan2(delta.y, delta.x) / step) * step;

  return { x: from.x + Math.cos(snapped) * size, y: from.y + Math.sin(snapped) * size };
}

/** Shoelace formula, absolute: the winding of the polygon does not matter. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;

  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    total += current.x * next.y - next.x * current.y;
  }

  return Math.abs(total) / 2;
}

/**
 * Centroid of the polygon's *area*, which is where a room label belongs — the
 * average of the vertices would drift towards whichever side has more of them.
 * Falls back to the average for a degenerate (zero-area) polygon.
 */
export function polygonCentroid(points: Point[]): Point {
  let doubleArea = 0;
  let x = 0;
  let y = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    doubleArea += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }

  if (doubleArea === 0) {
    const count = points.length || 1;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / count,
      y: points.reduce((sum, point) => sum + point.y, 0) / count,
    };
  }

  return { x: x / (3 * doubleArea), y: y / (3 * doubleArea) };
}

/** Whether `point` is inside the polygon (ray casting, odd crossings = in). */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];

    const crosses = a.y > point.y !== b.y > point.y;
    if (!crosses) continue;

    const atX = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (point.x < atX) inside = !inside;
  }

  return inside;
}
