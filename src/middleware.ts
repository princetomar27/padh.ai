import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Centralized Authentication Middleware
 *
 * This middleware handles authentication and role-based routing:
 * - Public routes: /sign-in, /sign-up (accessible without authentication)
 * - Protected routes: All other routes require authentication
 * - Onboarding flow: New users must complete onboarding before accessing protected routes
 * - Role-based routing: Users are redirected to their role-specific pages
 *   - STUDENT/TEACHER → /subjects
 *   - PARENT → /students
 *   - ADMIN → /admin
 */

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
        .select({ isOnboarded: user.isOnboarded, userRole: user.role })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      const isOnboarded = userData[0]?.isOnboarded ?? false;
      const userRole = userData[0]?.userRole ?? "STUDENT";

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
        // Redirect from auth pages to role-specific dashboard
        if (
          pathname.startsWith("/sign-in") ||
          pathname.startsWith("/sign-up") ||
          pathname.startsWith("/onboarding")
        ) {
          // Redirect to specific role page based on user role
          if (userRole === "STUDENT") {
            return NextResponse.redirect(new URL("/subjects", request.url));
          } else if (userRole === "TEACHER") {
            return NextResponse.redirect(new URL("/teachers", request.url));
          } else if (userRole === "PARENT") {
            return NextResponse.redirect(new URL("/students", request.url));
          } else if (userRole === "ADMIN") {
            return NextResponse.redirect(new URL("/admin", request.url));
          } else {
            return NextResponse.redirect(new URL("/", request.url));
          }
        }

        // Redirect from root dashboard to role-specific page
        if (pathname === "/") {
          if (userRole === "STUDENT") {
            return NextResponse.redirect(new URL("/subjects", request.url));
          } else if (userRole === "TEACHER") {
            return NextResponse.redirect(new URL("/teachers", request.url));
          } else if (userRole === "PARENT") {
            return NextResponse.redirect(new URL("/students", request.url));
          } else if (userRole === "ADMIN") {
            return NextResponse.redirect(new URL("/admin", request.url));
          }
        }
        // Allow access to all other protected routes
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
     * - *.png, *.jpg, *.jpeg, *.gif, *.svg (image files)
     * - *.ico (icon files)
     * - *.css, *.js (static assets)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.css$|.*\\.js$).*)",
  ],
};
