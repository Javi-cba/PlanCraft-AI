/**
 * Colours the canvas draws with.
 *
 * Konva paints to a bitmap, so it cannot read a Tailwind class: these are the
 * literal values of the tokens in `app/globals.css`. Keep them in step with
 * `@theme` — they are the same palette, written twice because the canvas has no
 * other way to see it.
 */
export const CANVAS_COLORS = {
  /** paper-50 / paper-100 — the sheet the plan is drawn on. */
  sheet: "#fbf9f4",
  sheetEdge: "#e8e1d2",
  /** paper-300 — millimetre paper. */
  gridMinor: "#ded6c4",
  gridMajor: "#cbbfa4",
  /** ink-900 — built walls. */
  wall: "#111721",
  /** blueprint-600 / 400 — selection and live previews. */
  accent: "#26395c",
  accentSoft: "#4a6a9e",
  /** blueprint-400 at low alpha — room fill. */
  roomFill: "rgba(74, 106, 158, 0.10)",
  roomFillSelected: "rgba(74, 106, 158, 0.22)",
  roomLabel: "#2a3446",
  /** timber — doors and windows, the warm accent of the brand. */
  opening: "#b0794a",
  openingSoft: "#dcbb92",
  /** Text on the little length badges. */
  badge: "#111721",
  badgeText: "#fbf9f4",
} as const;

/** Line weights in **screen pixels** — divided by the zoom before drawing. */
export const CANVAS_WEIGHTS = {
  hairline: 1,
  thin: 1.5,
  medium: 2,
  selection: 3,
  /** Extra pixels around a shape that still count as a hit. */
  hitPadding: 14,
  handle: 5,
  fontSize: 12,
  roomFontSize: 13,
} as const;
