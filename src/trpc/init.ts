import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
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
export const createTRPCContext = cache(async () => {
  return { userId: "user_123" };
});

const t = initTRPC.create({});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;

// PROTECTED PROCEDURE
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  const session = await auth.api.getSession({
    headers: await headers(),
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
