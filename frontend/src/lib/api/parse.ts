import { z } from "zod";

import { ApiError, CLIENT_ERROR_CODES, CLIENT_ERROR_MESSAGES } from "./client";

/**
 * Validates a successful response against its zod schema.
 *
 * A mismatch means the backend contract moved: it is logged with the real
 * issues for whoever is debugging, and surfaced as an `ApiError` so components
 * keep handling a single error type.
 */
export function parsePayload<T>(
  schema: z.ZodType<T>,
  payload: unknown,
  context: string,
): T {
  const result = schema.safeParse(payload);

  if (result.success) return result.data;

  console.error(`[api] ${context} devolvió una forma inesperada`, {
    issues: z.treeifyError(result.error),
    payload,
  });

  throw new ApiError(
    CLIENT_ERROR_CODES.invalidResponse,
    CLIENT_ERROR_MESSAGES[CLIENT_ERROR_CODES.invalidResponse],
    0,
    result.error.issues,
  );
}
