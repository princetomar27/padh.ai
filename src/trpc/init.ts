import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { auth, currentUser } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { cache } from "react";

// ─── Context ─────────────────────────────────────────────────────────────────

export const createTRPCContext = cache(async (opts?: { req: Request }) => {
  return {
    req: opts?.req,
  };
});

// ─── tRPC instance ────────────────────────────────────────────────────────────

const t = initTRPC.context<{ req?: Request }>().create({});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// ─── Protected Procedure ─────────────────────────────────────────────────────

/**
 * protectedProcedure — Requires a valid Clerk session.
 *
 * Injects `ctx.userId` (Clerk user ID) and `ctx.user` (userProfiles DB row).
 *
 * Upsert strategy: if no user_profiles row exists yet (e.g. the Clerk webhook
 * hasn't fired yet after a fresh sign-up), we fetch the user from Clerk and
 * create the row inline. This makes the system resilient to webhook delays and
 * works correctly in local dev without a webhook tunnel.
 */
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const { userId } = await auth();

  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  // Try to find the existing profile first (hot path — one DB query)
  let [user] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, userId))
    .limit(1);

  // Upsert: webhook may not have fired yet (first request after sign-up)
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

    // Re-fetch in case onConflictDoNothing() swallowed a concurrent insert
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

  return next({ ctx: { ...ctx, userId, user } });
});

// ─── Admin Procedure ──────────────────────────────────────────────────────────

/**
 * adminProcedure — Extends protectedProcedure; throws FORBIDDEN if the
 * authenticated user does not have the ADMIN role.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Admin access required. Your role: ${ctx.user.role}`,
    });
  }

  return next({ ctx });
});

/** Learning / study flows — students only. */
export const studentProcedure = protectedProcedure.use(
  async ({ ctx, next }) => {
    if (ctx.user.role !== "STUDENT") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This action is only available to students.",
      });
    }
    if (ctx.user.class == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Set your class in onboarding to use study features.",
      });
    }
    return next({ ctx });
  },
);
