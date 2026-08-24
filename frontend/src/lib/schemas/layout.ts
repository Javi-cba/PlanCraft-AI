import { z } from "zod";

/**
 * The architectural layout of a floor, mirroring `backend/app/schemas/layout.py`.
 *
 * It belongs to the **floor** and not to the plan: the electrical, sanitary and
 * gas plans of the same storey are drawn over the same walls, so keeping one
 * copy is what stops the three from drifting apart.
 *
 * Everything is in **centimetres** on a plain cartesian plane with +y pointing
 * down, the same axis the canvas uses — no conversion between the two.
 */

export const LAYOUT_VERSION = 1;

/** ±1 km around the origin. Same guardrail as the backend. */
export const COORDINATE_LIMIT = 100_000;

export const MAX_WALLS = 4_000;
export const MAX_OPENINGS = 2_000;
export const MAX_ROOMS = 500;
export const MAX_ROOM_POINTS = 64;

export const MIN_WALL_LENGTH = 1;

export const WALL_MIN_THICKNESS = 1;
export const WALL_MAX_THICKNESS = 200;
export const DEFAULT_WALL_THICKNESS = 15;

export const OPENING_MIN_WIDTH = 10;
export const OPENING_MAX_WIDTH = 1_000;
export const DEFAULT_DOOR_WIDTH = 90;
export const DEFAULT_WINDOW_WIDTH = 120;

export const ROOM_NAME_MAX_LENGTH = 80;

const coordinate = z
  .number()
  .min(-COORDINATE_LIMIT)
  .max(COORDINATE_LIMIT)
  // NaN and ±Infinity pass `z.number()`; a canvas that produced one would
  // otherwise corrupt the whole drawing.
  .refine(Number.isFinite, "La coordenada no es un número válido.");

export const pointSchema = z.object({ x: coordinate, y: coordinate });

export const wallSchema = z.object({
  id: z.string().min(1).max(64),
  a: pointSchema,
  b: pointSchema,
  thickness: z.number().min(WALL_MIN_THICKNESS).max(WALL_MAX_THICKNESS),
});

/** Doors and windows. Same shape for both — only the drawing differs. */
export const OPENING_KINDS = ["door", "window"] as const;

export const openingKindSchema = z.enum(OPENING_KINDS);

export const openingSchema = z.object({
  id: z.string().min(1).max(64),
  wall_id: z.string().min(1).max(64),
  kind: openingKindSchema,
  /** Centre of the opening along the wall, as a fraction from `a` to `b`. */
  position: z.number().gt(0).lt(1),
  width: z.number().min(OPENING_MIN_WIDTH).max(OPENING_MAX_WIDTH),
  /** Which side the leaf swings to. Ignored for a window. */
  flipped: z.boolean(),
});

export const roomSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(ROOM_NAME_MAX_LENGTH),
  points: z.array(pointSchema).min(3).max(MAX_ROOM_POINTS),
});

export const layoutSchema = z.object({
  version: z.literal(LAYOUT_VERSION).default(LAYOUT_VERSION),
  units: z.literal("cm").default("cm"),
  walls: z.array(wallSchema).max(MAX_WALLS).default([]),
  openings: z.array(openingSchema).max(MAX_OPENINGS).default([]),
  rooms: z.array(roomSchema).max(MAX_ROOMS).default([]),
});

/** Counts and total area the backend derives on every read. Never sent up. */
export const layoutSummarySchema = z.object({
  walls: z.int().min(0),
  openings: z.int().min(0),
  rooms: z.int().min(0),
  area_m2: z.number().min(0),
});

export type Point = z.infer<typeof pointSchema>;
export type Wall = z.infer<typeof wallSchema>;
export type Opening = z.infer<typeof openingSchema>;
export type OpeningKind = z.infer<typeof openingKindSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Layout = z.infer<typeof layoutSchema>;
export type LayoutSummary = z.infer<typeof layoutSummarySchema>;

export const OPENING_KIND_LABELS: Record<OpeningKind, string> = {
  door: "Puerta",
  window: "Ventana",
};

export const DEFAULT_OPENING_WIDTH: Record<OpeningKind, number> = {
  door: DEFAULT_DOOR_WIDTH,
  window: DEFAULT_WINDOW_WIDTH,
};

/** A layout with nothing drawn on it. A new floor starts here. */
export function emptyLayout(): Layout {
  return { version: LAYOUT_VERSION, units: "cm", walls: [], openings: [], rooms: [] };
}
