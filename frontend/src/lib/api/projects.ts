import {
  projectCreateSchema,
  projectListSchema,
  projectSchema,
  type Project,
  type ProjectCreateInput,
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
 */
export async function createProject(
  api: ApiClient,
  input: ProjectCreateInput,
): Promise<Project> {
  const body = projectCreateSchema.parse(input);
  const payload = await api.post<unknown>("/projects", { body });

  return parsePayload(projectSchema, payload, "POST /projects");
}

/** `GET /projects`. The backend only ever returns the caller's own projects. */
export async function listProjects(api: ApiClient): Promise<Project[]> {
  const payload = await api.get<unknown>("/projects");

  return parsePayload(projectListSchema, payload, "GET /projects");
}
