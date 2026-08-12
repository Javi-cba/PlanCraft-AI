import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

import { PROTECTED_ROUTES } from "@/lib/auth/routes";

// Next.js 16 renamed the `middleware` file convention to `proxy`, and the
// exported function must be named `proxy`.
const isProtectedRoute = createRouteMatcher([...PROTECTED_ROUTES]);

export const proxy = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
