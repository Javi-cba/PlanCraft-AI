import {
  planCreateSchema,
  planListSchema,
  planSchema,
  planUpdateSchema,
  type Plan,
  type PlanCreateInput,
  type PlanUpdateInput,
} from "@/lib/schemas/plan";

import type { ApiClient } from "./client";
import { parsePayload } from "./parse";

/** Plans endpoints. Same shape as the projects and floors ones. */

/**
 * `POST /floors/{floor_id}/plans`. A floor whose project is not the caller's
 * answers 404 `FLOOR_NOT_FOUND`; an unknown `installation_type` answers 422
 * `VALIDATION_ERROR` — both arrive as an `ApiError` with a Spanish message.
 */
export async function createPlan(
  api: ApiClient,
  floorId: string,
  input: PlanCreateInput,
): Promise<Plan> {
  const body = planCreateSchema.parse(input);
  const payload = await api.post<unknown>(
    `/floors/${encodeURIComponent(floorId)}/plans`,
    { body },
  );

  return parsePayload(planSchema, payload, "POST /floors/{floor_id}/plans");
}

/** `GET /floors/{floor_id}/plans` — every plan of a floor, oldest first. */
export async function listPlans(api: ApiClient, floorId: string): Promise<Plan[]> {
  const payload = await api.get<unknown>(
    `/floors/${encodeURIComponent(floorId)}/plans`,
  );

  return parsePayload(planListSchema, payload, "GET /floors/{floor_id}/plans");
}

/** `GET /plans/{plan_id}`. */
export async function getPlan(api: ApiClient, planId: string): Promise<Plan> {
  const payload = await api.get<unknown>(`/plans/${encodeURIComponent(planId)}`);

  return parsePayload(planSchema, payload, "GET /plans/{plan_id}");
}

/** `PATCH /plans/{plan_id}` — rename, change the installation, save the canvas. */
export async function updatePlan(
  api: ApiClient,
  planId: string,
  input: PlanUpdateInput,
): Promise<Plan> {
  const body = planUpdateSchema.parse(input);
  const payload = await api.patch<unknown>(`/plans/${encodeURIComponent(planId)}`, {
    body,
  });

  return parsePayload(planSchema, payload, "PATCH /plans/{plan_id}");
}

/** `DELETE /plans/{plan_id}` — takes the elements placed on it with it. */
export async function deletePlan(api: ApiClient, planId: string): Promise<void> {
  await api.delete<unknown>(`/plans/${encodeURIComponent(planId)}`);
}
