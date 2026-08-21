import {
  projectCreateSchema,
  projectPageSchema,
  projectSchema,
  type Project,
  type ProjectCreateInput,
  type ProjectListQuery,
  type ProjectPage,
} from "@/lib/schemas/project";

import type { ApiClient } from "./client";
import { parsePayload } from "./parse";

/**
 * Projects endpoints. Every function takes the API client so the Clerk token
 * comes from the right place: `useApi()` in a client component, `getServerApi()`
 * in a Server Component.
 */

/**
 * `POST /projects`. The owner is never sent: the backend reads it from the
 * validated token, and rejects `external_user_id` if it shows up in the body.
 *
 * The backend also creates the ground floor and the first plan in the same
 * transaction, so the project comes back ready to open.
 */
export async function createProject(
  api: ApiClient,
  input: ProjectCreateInput,
): Promise<Project> {
  const body = projectCreateSchema.parse(input);
  const payload = await api.post<unknown>("/projects", { body });

  return parsePayload(projectSchema, payload, "POST /projects");
}

/**
 * `GET /projects`, one page at a time. The backend only ever returns the
 * caller's own projects, and rejects an unknown query parameter with a 422.
 */
export async function listProjects(
  api: ApiClient,
  query: ProjectListQuery = {},
): Promise<ProjectPage> {
  const payload = await api.get<unknown>("/projects", { query });

  return parsePayload(projectPageSchema, payload, "GET /projects");
}
