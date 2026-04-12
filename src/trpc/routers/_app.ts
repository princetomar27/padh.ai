import { createTRPCRouter } from "../init";
import { onboardingRouter } from "@/modules/auth/server/procedure";
import { classesRouter } from "@/modules/classes/server/procedure";
import { adminRouter } from "@/modules/admin/server/procedure";
import { subjectsRouter } from "@/modules/subjects/server/procedure";
import { booksRouter } from "@/modules/books/server/procedure";
import { chaptersRouter } from "@/modules/chapters/server/procedure";
import { agentsRouter } from "@/modules/agents/server/procedure";
import { learningRouter } from "@/modules/learning/server/procedure";

/** Root tRPC router for padh.ai. */
export const appRouter = createTRPCRouter({
  auth: onboardingRouter,
  classes: classesRouter,
  admin: adminRouter,
  subjects: subjectsRouter,
  books: booksRouter,
  chapters: chaptersRouter,
  agents: agentsRouter,
  learning: learningRouter,
});

export type AppRouter = typeof appRouter;
