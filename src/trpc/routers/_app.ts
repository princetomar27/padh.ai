import { createTRPCRouter } from "../init";
import { onboardingRouter } from "@/modules/auth/server/procedure";
import { classesRouter } from "@/modules/classes/server/procedure";
import { adminRouter } from "@/modules/admin/server/procedure";

/**
 * Root tRPC router for padh.ai.
 *
 * Phase 2 (Clerk auth migration): Only auth, classes, and admin routers
 * are active. The old meetings, agents, and premium routers used Better Auth
 * and Stream.io references — they are excluded here and will be rebuilt in
 * Phase 3+ as padh.ai-specific modules (PDF pipeline, AI sessions, etc.).
 */
export const appRouter = createTRPCRouter({
  auth: onboardingRouter,
  classes: classesRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
