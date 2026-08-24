import { z } from "zod";

/**
 * Contract of the plans endpoints, mirroring `backend/app/schemas/plan.py`.
 * `floor_id` travels in the URL; the backend walks floor → project → owner
 * before writing anything.
 */

export const PLAN_NAME_MAX_LENGTH = 120;

/** The installation a plan draws. Same values as the column's CHECK constraint. */
export const INSTALLATION_TYPES = ["electrical", "sanitary", "gas"] as const;

export const installationTypeSchema = z.enum(INSTALLATION_TYPES, {
  error: "Elegí un tipo de instalación.",
});

export type InstallationType = z.infer<typeof installationTypeSchema>;

/** Labels for the UI. The values stay in English, the text does not. */
export const INSTALLATION_TYPE_LABELS: Record<InstallationType, string> = {
  electrical: "Eléctrica",
  sanitary: "Sanitaria",
  gas: "Gas",
};

/** Canvas state (scale, size, background). Free-form: only the editor reads it. */
const canvasMetaSchema = z.record(z.string(), z.unknown());

/** Body of `POST /floors/{floor_id}/plans`. */
export const planCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ponele un nombre al plano.")
    .max(
      PLAN_NAME_MAX_LENGTH,
      `El nombre no puede tener más de ${PLAN_NAME_MAX_LENGTH} caracteres.`,
    ),
  installation_type: installationTypeSchema,
  canvas_meta: canvasMetaSchema.default({}),
});

export type PlanCreateInput = z.input<typeof planCreateSchema>;
export type PlanCreateBody = z.infer<typeof planCreateSchema>;

/** Body of `PATCH /plans/{plan_id}`. Only the fields sent are written. */
export const planUpdateSchema = z
  .object({
    name: planCreateSchema.shape.name.optional(),
    installation_type: installationTypeSchema.optional(),
    canvas_meta: canvasMetaSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "No enviaste ningún campo para actualizar.",
  );

export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

/** A plan as the API returns it. */
export const planSchema = z.object({
  id: z.guid(),
  floor_id: z.guid(),
  name: z.string(),
  installation_type: installationTypeSchema,
  canvas_meta: canvasMetaSchema,
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const planListSchema = z.array(planSchema);

export type Plan = z.infer<typeof planSchema>;
