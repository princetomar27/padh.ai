import { db } from "@/db";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { createUserSchema } from "../schema";
import { user } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const onboardingRouter = createTRPCRouter({
  onboardUser: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ input, ctx }) => {
      // Prepare update data based on role
      const updateData = {
        name: input.name,
        role: input.role,
        isOnboarded: true,
        ...(input.role === "STUDENT" && {
          class: input.class,
          school: input.school,
        }),
      };

      const [updatedUser] = await db
        .update(user)
        .set(updateData)
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
