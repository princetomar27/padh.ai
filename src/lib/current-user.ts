import "server-only";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";

/**
 * getCurrentUser — Server-side helper to get the authenticated user's profile.
 *
 * Uses React cache() so multiple calls in the same request return the same
 * DB query result without re-fetching. Safe to call from Server Components,
 * Route Handlers, and tRPC procedures.
 *
 * Returns null if:
 *  - No Clerk session (unauthenticated)
 *  - Clerk userId exists but no user_profiles row yet (rare race condition
 *    between sign-up and webhook delivery — the onboarding page handles this)
 */
export const getCurrentUser = cache(async () => {
  const { userId } = await auth();

  if (!userId) return null;

  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, userId))
    .limit(1);

  return profile ?? null;
});

/**
 * requireUser — Like getCurrentUser but throws if not authenticated.
 * Use in tRPC procedures or Server Actions that must be authenticated.
 */
export const requireUser = cache(async () => {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
});
