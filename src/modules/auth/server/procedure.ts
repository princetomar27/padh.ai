import { db } from "@/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { createUserSchema } from "../schema";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { clerkClient } from "@clerk/nextjs/server";

export const onboardingRouter = createTRPCRouter({
  /**
   * onboardUser — idempotent mutation.
   *
   * Always updates the profile (no isOnboarded=false guard) so re-submissions
   * and retries never get stuck. Always syncs Clerk publicMetadata so the
   * middleware's sessionClaims reflect the current state immediately.
   *
   * This handles the edge case where:
   *  - A previous attempt updated the DB but the Clerk metadata sync failed
   *  - The user refreshes the onboarding page and resubmits
   *  - The user changes their mind and resubmits with different data
   */
  onboardUser: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ input, ctx }) => {
      const updateData = {
        name: input.name,
        role: input.role,
        isOnboarded: true,
        updatedAt: new Date(),
        ...(input.role === "STUDENT" && {
          class: input.class,
          school: input.school,
        }),
        // Clear class/school if role changed away from STUDENT
        ...(input.role !== "STUDENT" && {
          class: null,
          school: null,
        }),
      };

      const [updatedUser] = await db
        .update(userProfiles)
        .set(updateData)
        .where(eq(userProfiles.id, ctx.user.id))
        .returning();

      if (!updatedUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User profile not found. Please sign out and sign in again.",
        });
      }

      // Sync isOnboarded + role into Clerk publicMetadata.
      // The middleware reads sessionClaims.metadata — this makes the next
      // request immediately see isOnboarded:true without a DB lookup.
      const clerk = await clerkClient();
      await clerk.users.updateUserMetadata(ctx.userId, {
        publicMetadata: {
          isOnboarded: true,
          role: updatedUser.role,
        },
      });

      return updatedUser;
    }),

  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    const [currentUser] = await db
      .select({
        id: userProfiles.id,
        name: userProfiles.name,
        email: userProfiles.email,
        role: userProfiles.role,
        image: userProfiles.image,
        class: userProfiles.class,
        school: userProfiles.school,
        isOnboarded: userProfiles.isOnboarded,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, ctx.user.id))
      .limit(1);

    if (!currentUser) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return currentUser;
  }),
});
