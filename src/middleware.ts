import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * padh.ai — Clerk Authentication Middleware
 *
 * Route logic:
 *  PUBLIC   → /sign-in, /sign-up, /api/webhooks/*
 *  ONBOARD  → /onboarding  (authenticated but not yet onboarded)
 *  STUDENT  → /dashboard   (default landing after onboarding)
 *  PARENT   → /parents
 *  ADMIN    → /admin
 *
 * Onboarding status is read from Clerk's publicMetadata.isOnboarded.
 * We update publicMetadata via the onboarding tRPC mutation (server-side
 * Clerk Admin SDK call) so it's available in the session JWT immediately.
 */

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims, redirectToSignIn } = await auth();

  const { pathname } = req.nextUrl;

  // 1. Unauthenticated + public route → allow
  if (!userId && isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 2. Unauthenticated + protected route → redirect to sign-in
  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // 3. Read onboarding state from Clerk session metadata
  //    Set by the onboardUser tRPC mutation via Clerk Admin SDK
  const meta = sessionClaims?.metadata as
    | { isOnboarded?: boolean; role?: string }
    | undefined;

  // Read the immediate routing cookie set by the client to bypass JWT delays
  const hasLocalCookie = req.cookies.get("padh_ai_onboarded")?.value === "true";
  const isOnboarded = meta?.isOnboarded === true || hasLocalCookie;
  const userRole = meta?.role as string | undefined;

  // 4. Not onboarded → force /onboarding
  //    Skip API routes — tRPC calls from the onboarding form must reach the server.
  //    Without this, /api/trpc/auth.onboardUser gets redirected to /onboarding (HTML)
  //    and the client receives "Unexpected token '<'" instead of JSON.
  const isApiRoute = pathname.startsWith("/api/");
  if (
    !isOnboarded &&
    !isOnboardingRoute(req) &&
    !isPublicRoute(req) &&
    !isApiRoute
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.url));
  }

  // 5. Onboarded + visiting onboarding / auth pages → redirect to dashboard
  if (
    isOnboarded &&
    (isOnboardingRoute(req) ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up"))
  ) {
    return NextResponse.redirect(new URL(getRoleDashboard(userRole), req.url));
  }

  // 6. Root path → redirect to role-specific dashboard
  if (pathname === "/" && isOnboarded) {
    return NextResponse.redirect(new URL(getRoleDashboard(userRole), req.url));
  }

  return NextResponse.next();
});

/** Maps a user role to its default landing page. */
function getRoleDashboard(role?: string): string {
  switch (role) {
    case "ADMIN":
      return "/admin";
    case "PARENT":
      return "/parents";
    case "STUDENT":
    default:
      return "/dashboard";
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
