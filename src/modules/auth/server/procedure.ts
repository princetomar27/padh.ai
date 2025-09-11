import { db } from "@/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { createUserSchema } from "../schema";
import { user } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const onboardingRouter = createTRPCRouter({
  createUser: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ input, ctx }) => {
      const [updatedUser] = await db
        .update(user)
        .set({
          ...input,
          isOnboarded: true,
        })
        .where(and(eq(user.id, ctx.auth.user.id), eq(user.isOnboarded, false)))
        .returning();

      if (!updatedUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found or already onboarded",
        });
      }
      return updatedUser;
    }),
});
