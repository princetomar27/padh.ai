import "server-only";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

export type SessionUserProfile = typeof userProfiles.$inferSelect;

/**
 * Resolves the signed-in Clerk user to a `user_profiles` row (with webhook-delay upsert).
 * Same behavior as `protectedProcedure` in `trpc/init.ts`.
 */
export async function getSessionUserProfile(): Promise<{
  userId: string;
  user: SessionUserProfile;
}> {
  const { userId } = await auth();

  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  let [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, userId))
    .limit(1);

  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Could not resolve Clerk user.",
      });
    }

    const email =
      clerkUser.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId,
      )?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Clerk account has no email address.",
      });
    }

    const [created] = await db
      .insert(userProfiles)
      .values({
        clerkId: userId,
        name: clerkUser.fullName ?? clerkUser.username ?? "User",
        email,
        image: clerkUser.imageUrl ?? null,
        role: "STUDENT",
        isOnboarded: false,
      })
      .onConflictDoNothing()
      .returning();

    if (!created) {
      const [existing] = await db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.clerkId, userId))
        .limit(1);
      user = existing;
    } else {
      user = created;
    }

    if (!user) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create user profile.",
      });
    }
  }

  return { userId, user };
}
