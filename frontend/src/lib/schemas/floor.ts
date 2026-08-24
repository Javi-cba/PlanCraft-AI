import { z } from "zod";

import { layoutSchema, layoutSummarySchema } from "./layout";
import { planSchema } from "./plan";

/**
 * Contract of the floors endpoints, mirroring `backend/app/schemas/floor.py`.
 * `project_id` is not part of the create schema: it travels in the URL, and the
 * backend checks the project belongs to the signed-in user.
 *
 * Lists never carry the layout — a whole house is far more than a card needs —
 * so a floor always brings a derived `summary`, and only the detail endpoint
 * adds the drawing itself.
 */

export const FLOOR_NAME_MAX_LENGTH = 120;
export const FLOOR_MIN_LEVEL = -10;
export const FLOOR_MAX_LEVEL = 200;

const floorName = z
  .string()
  .trim()
  .min(1, "Ponele un nombre al piso.")
  .max(
    FLOOR_NAME_MAX_LENGTH,
    `El nombre no puede tener más de ${FLOOR_NAME_MAX_LENGTH} caracteres.`,
  );

const floorLevel = z
  .int({ error: "El nivel tiene que ser un número entero." })
  .min(FLOOR_MIN_LEVEL, `El nivel mínimo es ${FLOOR_MIN_LEVEL}.`)
  .max(FLOOR_MAX_LEVEL, `El nivel máximo es ${FLOOR_MAX_LEVEL}.`);

/**
 * Body of `POST /projects/{project_id}/floors`.
 *
 * `layout` is how a template is applied: the walls travel with the floor, so
 * choosing a template is one request instead of "create blank, then save".
 */
export const floorCreateSchema = z.object({
  name: floorName,
  // 0 = planta baja, igual que en el backend.
  level: floorLevel.default(0),
  layout: layoutSchema.default(layoutSchema.parse({})),
});

export type FloorCreateInput = z.input<typeof floorCreateSchema>;
export type FloorCreateBody = z.infer<typeof floorCreateSchema>;

/** Body of `PATCH /floors/{floor_id}`. Only the fields sent are written. */
export const floorUpdateSchema = z
  .object({
    name: floorName.optional(),
    level: floorLevel.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "No enviaste ningún campo para actualizar.",
  );

export type FloorUpdateInput = z.infer<typeof floorUpdateSchema>;

/** A floor as the API returns it: no drawing, just how much is on it. */
export const floorSchema = z.object({
  id: z.guid(),
  project_id: z.guid(),
  name: z.string(),
  level: z.int(),
  summary: layoutSummarySchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

/** A floor plus its plans — what the project page lists. */
export const floorWithPlansSchema = floorSchema.extend({
  plans: z.array(planSchema),
});

/** Everything about a floor, layout included. What the editor opens with. */
export const floorDetailSchema = floorWithPlansSchema.extend({
  layout: layoutSchema,
});

export const floorListSchema = z.array(floorSchema);

export type Floor = z.infer<typeof floorSchema>;
export type FloorWithPlans = z.infer<typeof floorWithPlansSchema>;
export type FloorDetail = z.infer<typeof floorDetailSchema>;

/**
 * "Planta Baja" is level 0, and everything else reads off it. Used as the
 * default name when a floor is added from the project page.
 */
export function defaultFloorName(level: number): string {
  if (level === 0) return "Planta Baja";
  if (level > 0) return `Planta Alta ${level}`;
  return `Subsuelo ${Math.abs(level)}`;
}

/** Short badge for a floor card: "PB", "1º", "-1º". */
export function floorLevelLabel(level: number): string {
  if (level === 0) return "PB";
  if (level > 0) return `${level}º`;
  return `${level}º`;
}
