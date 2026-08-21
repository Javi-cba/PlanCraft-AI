import { z } from "zod";

import { installationTypeSchema } from "./plan";

/**
 * Contract of the projects endpoints, mirroring
 * `backend/app/schemas/project.py`. The API speaks snake_case and these
 * schemas keep it: one shape to compare against the backend, no hidden mapping.
 *
 * `external_user_id` is absent from the create schema on purpose — the backend
 * derives the owner from the Clerk token and rejects the field in the body.
 */

export const PROJECT_NAME_MAX_LENGTH = 120;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 2_000;

/** Body of `POST /projects`, with the messages the form shows per field. */
export const projectCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Ponele un nombre al proyecto.")
    .max(
      PROJECT_NAME_MAX_LENGTH,
      `El nombre no puede tener más de ${PROJECT_NAME_MAX_LENGTH} caracteres.`,
    ),
  description: z
    .string()
    .trim()
    .max(
      PROJECT_DESCRIPTION_MAX_LENGTH,
      `La descripción no puede tener más de ${PROJECT_DESCRIPTION_MAX_LENGTH} caracteres.`,
    )
    .nullish()
    // An empty textarea means "no description", same as in the backend.
    .transform((value) => value || null),
  // Installation of the first plan: creating a project also creates its ground
  // floor and one plan on it, so the editor has something to open.
  installation_type: installationTypeSchema.default("electrical"),
});

/** What a caller may hand in: `description` is optional. */
export type ProjectCreateInput = z.input<typeof projectCreateSchema>;
/** What actually travels in the request body. */
export type ProjectCreateBody = z.infer<typeof projectCreateSchema>;

/**
 * A project as the API returns it.
 *
 * Ids use `z.guid()` and not `z.uuid()`: the latter also pins the version and
 * variant bits, so a perfectly usable id (a seeded row, a future uuid v7) would
 * be rejected as an invalid response. The format check is what matters here.
 */
export const projectSchema = z.object({
  id: z.guid(),
  external_user_id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
});

export const projectListSchema = z.array(projectSchema);

export type Project = z.infer<typeof projectSchema>;

/** Orderings `GET /projects` accepts, same values as the backend enum. */
export const PROJECT_SORTS = ["recent", "oldest", "name"] as const;

export const projectSortSchema = z.enum(PROJECT_SORTS);

export type ProjectSort = z.infer<typeof projectSortSchema>;

/** Labels for the sort control. Values in English, UI text in Spanish. */
export const PROJECT_SORT_LABELS: Record<ProjectSort, string> = {
  recent: "Más recientes",
  oldest: "Más antiguos",
  name: "Por nombre",
};

/** Page size the UI asks for. The backend caps `limit` at 100. */
export const PROJECT_PAGE_SIZE = 12;

/** The `Page` envelope from `backend/app/lib/responses.py`. */
export const projectPageSchema = z.object({
  items: z.array(projectSchema),
  total: z.int().min(0),
  limit: z.int().min(1),
  offset: z.int().min(0),
});

export type ProjectPage = z.infer<typeof projectPageSchema>;

/** Query string of `GET /projects`. Nullish values are dropped by the client. */
export type ProjectListQuery = {
  q?: string | null;
  sort?: ProjectSort;
  limit?: number;
  offset?: number;
};
