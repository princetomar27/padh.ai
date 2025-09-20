import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { polarClient } from "@/lib/polar";
import {
  MAX_FREE_AGENTS,
  MAX_FREE_MEETINGS,
} from "@/modules/premium/constants";
import { initTRPC, TRPCError } from "@trpc/server";
import { count, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
export const createTRPCContext = cache(async (opts?: { req: Request }) => {
  return {
    req: opts?.req,
  };
});

const t = initTRPC.context<{ req?: Request }>().create({});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// PROTECTED PROCEDURE
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({
    headers: ctx.req?.headers || (await headers()),
  });

  if (!session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
  }

  return next({ ctx: { ...ctx, auth: session } });
});

// Premium Protected Procedure
export const premiumProcedure = (entity: "meetings" | "agents") =>
  protectedProcedure.use(async ({ ctx, next }) => {
    const customer = await polarClient.customers.getStateExternal({
      externalId: ctx.auth.user.id,
    });

    const [userMeetings] = await db
      .select({
        count: count(meetings.id),
      })
      .from(meetings)
      .where(eq(meetings.userId, ctx.auth.user.id));

    const [userAgents] = await db
      .select({
        count: count(agents.id),
      })
      .from(agents)
      .where(eq(agents.userId, ctx.auth.user.id));

    const isPremiumUser = customer.activeSubscriptions.length > 0;

    const isFreeAgentLimitReached = userAgents.count >= MAX_FREE_AGENTS;
    const isFreeMeetingsLimitReached = userMeetings.count >= MAX_FREE_MEETINGS;

    const shouldThrowMeetingError =
      entity === "meetings" && isFreeMeetingsLimitReached && !isPremiumUser;

    const shouldThrowAgentError =
      entity === "agents" && isFreeAgentLimitReached && !isPremiumUser;

    if (shouldThrowMeetingError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You have reached the maximum number of free meetings",
      });
    }

    if (shouldThrowAgentError) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You have reached the maximum number of free agents",
      });
    }

    return next({ ctx: { ...ctx, customer } });
  });

export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Check if user is admin
  const [userRecord] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, ctx.auth.user.id));

  if (!userRecord || userRecord.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Admin access required. Current role: ${
        userRecord?.role || "none"
      }`,
    });
  }

  return next({ ctx });
});
