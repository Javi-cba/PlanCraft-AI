import { auth } from "@clerk/nextjs/server";

import { createApi, type ApiClient } from "@/lib/api/client";

/**
 * Server-side Clerk helpers. Import only from Server Components, Route
 * Handlers or Server Actions — never from a `"use client"` module.
 */

/** Current session token, or `null` when the visitor is signed out. */
export async function getServerAuthToken(): Promise<string | null> {
  const { getToken } = await auth();
  return getToken();
}

/** API client that authenticates against the backend as the current user. */
export function getServerApi(): ApiClient {
  return createApi(getServerAuthToken);
}
