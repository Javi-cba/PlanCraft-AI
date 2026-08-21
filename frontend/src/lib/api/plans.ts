import {
  planCreateSchema,
  planSchema,
  type Plan,
  type PlanCreateInput,
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
