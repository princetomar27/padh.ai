import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const { pathname } = request.nextUrl;

  // If user is not authenticated, allow access to auth pages
  if (!session) {
    if (pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up")) {
      return NextResponse.next();
    }
    // Redirect to sign-in for all other pages
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // If user is authenticated, check onboarding status from database
  if (session.user) {
    try {
      const userData = await db
        .select({ isOnboarded: user.isOnboarded })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      const isOnboarded = userData[0]?.isOnboarded ?? false;

      // If user is not onboarded
      if (!isOnboarded) {
        // Allow access to onboarding page
        if (pathname.startsWith("/onboarding")) {
          return NextResponse.next();
        }
        // Redirect to onboarding for all other pages
        return NextResponse.redirect(new URL("/onboarding", request.url));
      }

      // If user is onboarded
      if (isOnboarded) {
        // Redirect from auth pages to dashboard
        if (
          pathname.startsWith("/sign-in") ||
          pathname.startsWith("/sign-up") ||
          pathname.startsWith("/onboarding")
        ) {
          return NextResponse.redirect(new URL("/", request.url));
        }
        // Allow access to dashboard pages
        return NextResponse.next();
      }
    } catch (error) {
      // If there's an error fetching user data, redirect to sign-in
      console.error("Error fetching user data in middleware:", error);
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
