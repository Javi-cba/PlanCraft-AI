"use client";

import { useAuth } from "@clerk/nextjs";
import { useMemo } from "react";

import { createApi, type ApiClient } from "@/lib/api/client";

/**
 * API client bound to the signed-in user: every request carries the Clerk
 * session token. Use this instead of importing `api` in client components.
 */
export function useApi(): ApiClient {
  const { getToken } = useAuth();
  return useMemo(() => createApi(getToken), [getToken]);
}
