import { agentsRouter } from "@/modules/agents/server/procedures";
import { createTRPCRouter } from "../init";
import { meetingsRouter } from "@/modules/meetings/server/procedure";
import { premiumRouter } from "@/modules/premium/server/procedures";
import { onboardingRouter } from "@/modules/auth/server/procedure";

export const appRouter = createTRPCRouter({
  agents: agentsRouter,
  meetings: meetingsRouter,
  premium: premiumRouter,
  auth: onboardingRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
