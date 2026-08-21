import {
  floorCreateSchema,
  floorSchema,
  type Floor,
  type FloorCreateInput,
} from "@/lib/schemas/floor";

import type { ApiClient } from "./client";
import { parsePayload } from "./parse";

/**
 * Floors endpoints. Like the projects ones, they take the API client so the
 * Clerk token comes from `useApi()` or `getServerApi()`.
 */

/**
 * `POST /projects/{project_id}/floors`. A project that is not the caller's
 * answers 404 `PROJECT_NOT_FOUND`, which arrives as an `ApiError`.
 */
export async function createFloor(
  api: ApiClient,
  projectId: string,
  input: FloorCreateInput,
): Promise<Floor> {
  const body = floorCreateSchema.parse(input);
  const payload = await api.post<unknown>(
    `/projects/${encodeURIComponent(projectId)}/floors`,
    { body },
  );

  return parsePayload(floorSchema, payload, "POST /projects/{project_id}/floors");
}
