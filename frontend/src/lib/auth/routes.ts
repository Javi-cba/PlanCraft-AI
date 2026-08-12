/**
 * Route groups used by the Clerk proxy. Keeping them here means the matchers
 * live next to the rest of the auth config instead of inside `proxy.ts`.
 */

/** Routes that require a signed-in user. */
export const PROTECTED_ROUTES = ["/projects(.*)", "/api/protected(.*)"] as const;
