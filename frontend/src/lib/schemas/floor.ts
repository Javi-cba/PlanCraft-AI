import { z } from "zod";

/**
 * Contract of the floors endpoints, mirroring `backend/app/schemas/floor.py`.
 * `project_id` is not part of the create schema: it travels in the URL, and the
 * backend checks the project belongs to the signed-in user.
 */

export const FLOOR_NAME_MAX_LENGTH = 120;
export const FLOOR_MIN_LEVEL = -10;
export const FLOOR_MAX_LEVEL = 200;

/** Body of `POST /projects/{project_id}/floors`. */
export const floorCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ponele un nombre al piso.")
    .max(
      FLOOR_NAME_MAX_LENGTH,
      `El nombre no puede tener más de ${FLOOR_NAME_MAX_LENGTH} caracteres.`,
    ),
  level: z
    .int({ error: "El nivel tiene que ser un número entero." })
    .min(FLOOR_MIN_LEVEL, `El nivel mínimo es ${FLOOR_MIN_LEVEL}.`)
    .max(FLOOR_MAX_LEVEL, `El nivel máximo es ${FLOOR_MAX_LEVEL}.`)
    // 0 = planta baja, igual que en el backend.
    .default(0),
});

export type FloorCreateInput = z.input<typeof floorCreateSchema>;
export type FloorCreateBody = z.infer<typeof floorCreateSchema>;

/** A floor as the API returns it. */
export const floorSchema = z.object({
  id: z.guid(),
  project_id: z.guid(),
  name: z.string(),
  level: z.int(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const floorListSchema = z.array(floorSchema);

export type Floor = z.infer<typeof floorSchema>;
