import { agentsRouter } from "@/modules/agents/server/procedures";
import { adminRouter } from "@/modules/admin/server/procedure";
import { classesRouter } from "@/modules/classes/server/procedure";
import { createTRPCRouter } from "../init";
import { meetingsRouter } from "@/modules/meetings/server/procedure";
import { premiumRouter } from "@/modules/premium/server/procedures";
import { onboardingRouter } from "@/modules/auth/server/procedure";

export const appRouter = createTRPCRouter({
  agents: agentsRouter,
  admin: adminRouter,
  meetings: meetingsRouter,
  premium: premiumRouter,
  auth: onboardingRouter,
  classes: classesRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
