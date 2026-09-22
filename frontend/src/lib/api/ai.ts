import {
  aiStatusSchema,
  conversationSchema,
  planAssistRequestSchema,
  planAssistResponseSchema,
  type AiStatus,
  type Conversation,
  type PlanAssistInput,
  type PlanAssistResponse,
} from "@/lib/schemas/ai";

import type { ApiClient } from "./client";
import { parsePayload } from "./parse";

/**
 * AI assistant endpoints. Like the rest, they take the API client so the Clerk
 * token comes from `useApi()` or `getServerApi()`.
 *
 * These are the only calls in the app that cost money per request, so they are
 * also the only ones that can come back 429 — `ApiError.code` is then
 * `AI_RATE_LIMITED` and `details.retry_after` says how many seconds to wait.
 */

/** `GET /ai/status` — is the assistant configured, and under what allowance. */
export async function getAiStatus(api: ApiClient): Promise<AiStatus> {
  const payload = await api.get<unknown>("/ai/status");

  return parsePayload(aiStatusSchema, payload, "GET /ai/status");
}

/**
 * `POST /ai/floors/{floor_id}/plan` — one turn with the assistant.
 *
 * Same call whether the floor is blank (it draws it) or already has walls (it
 * edits them): what changes is the layout that travels with the request.
 */
export async function assistPlan(
  api: ApiClient,
  floorId: string,
  input: PlanAssistInput,
): Promise<PlanAssistResponse> {
  const body = planAssistRequestSchema.parse(input);
  const payload = await api.post<unknown>(
    `/ai/floors/${encodeURIComponent(floorId)}/plan`,
    { body },
  );

  return parsePayload(
    planAssistResponseSchema,
    payload,
    "POST /ai/floors/{floor_id}/plan",
  );
}

/**
 * `GET /ai/floors/{floor_id}/conversation` — the thread of this floor.
 *
 * `null` when the assistant was never used here. That is the normal state of a
 * floor drawn by hand, not an error.
 */
export async function getFloorConversation(
  api: ApiClient,
  floorId: string,
): Promise<Conversation | null> {
  const payload = await api.get<unknown>(
    `/ai/floors/${encodeURIComponent(floorId)}/conversation`,
  );

  if (payload === null) return null;

  return parsePayload(
    conversationSchema,
    payload,
    "GET /ai/floors/{floor_id}/conversation",
  );
}
