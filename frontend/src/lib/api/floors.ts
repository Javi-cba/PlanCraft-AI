import {
  floorCreateSchema,
  floorDetailSchema,
  floorSchema,
  floorUpdateSchema,
  floorWithPlansSchema,
  type Floor,
  type FloorCreateInput,
  type FloorDetail,
  type FloorUpdateInput,
  type FloorWithPlans,
} from "@/lib/schemas/floor";
import { layoutSchema, type Layout } from "@/lib/schemas/layout";

import type { ApiClient } from "./client";
import { parsePayload } from "./parse";

/**
 * Floors endpoints. Like the projects ones, they take the API client so the
 * Clerk token comes from `useApi()` or `getServerApi()`.
 *
 * Creation is nested under the project; everything else addresses the floor by
 * its own id, because once you have it the parent adds nothing.
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

/** `GET /floors/{floor_id}` — the floor with its layout and its plans. */
export async function getFloor(api: ApiClient, floorId: string): Promise<FloorDetail> {
  const payload = await api.get<unknown>(`/floors/${encodeURIComponent(floorId)}`);

  return parsePayload(floorDetailSchema, payload, "GET /floors/{floor_id}");
}

/** `PATCH /floors/{floor_id}` — rename it or move it to another level. */
export async function updateFloor(
  api: ApiClient,
  floorId: string,
  input: FloorUpdateInput,
): Promise<FloorWithPlans> {
  const body = floorUpdateSchema.parse(input);
  const payload = await api.patch<unknown>(`/floors/${encodeURIComponent(floorId)}`, {
    body,
  });

  return parsePayload(floorWithPlansSchema, payload, "PATCH /floors/{floor_id}");
}

/**
 * `PUT /floors/{floor_id}/layout` — saves the drawing, whole.
 *
 * A PUT and not a PATCH: the editor always holds the complete layout, so
 * replacing it outright keeps a save idempotent and free of merge surprises
 * between two open tabs.
 */
export async function saveFloorLayout(
  api: ApiClient,
  floorId: string,
  layout: Layout,
): Promise<FloorDetail> {
  const body = { layout: layoutSchema.parse(layout) };
  const payload = await api.put<unknown>(
    `/floors/${encodeURIComponent(floorId)}/layout`,
    { body },
  );

  return parsePayload(floorDetailSchema, payload, "PUT /floors/{floor_id}/layout");
}

/** `DELETE /floors/{floor_id}` — takes the plans of the floor with it. */
export async function deleteFloor(api: ApiClient, floorId: string): Promise<void> {
  await api.delete<unknown>(`/floors/${encodeURIComponent(floorId)}`);
}
