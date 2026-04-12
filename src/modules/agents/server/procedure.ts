import { db } from "@/db";
import { agents, books, classes, subjects } from "@/db/schema";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { DEFAULT_TUTOR_INSTRUCTIONS } from "../constants";
import { updateTutorAgentSchema } from "../schemas";

export const agentsRouter = createTRPCRouter({
  listTutors: adminProcedure.query(async () => {
    return db
      .select({
        id: agents.id,
        name: agents.name,
        instructions: agents.instructions,
        voiceId: agents.voiceId,
        isActive: agents.isActive,
        subjectId: agents.subjectId,
        classId: agents.classId,
        subjectName: subjects.name,
        className: classes.name,
      })
      .from(agents)
      .innerJoin(subjects, eq(agents.subjectId, subjects.id))
      .innerJoin(classes, eq(agents.classId, classes.id))
      .where(eq(agents.agentRole, "TUTOR"))
      .orderBy(asc(subjects.name), asc(classes.number));
  }),

  /**
   * Create a TUTOR row for every (subject, class) pair that has at least one book,
   * when that tutor does not already exist.
   */
  seedMissingTutors: adminProcedure.mutation(async () => {
    const pairs = await db
      .selectDistinct({
        subjectId: books.subjectId,
        classId: books.classId,
      })
      .from(books)
      .where(eq(books.isActive, true));

    let created = 0;
    for (const p of pairs) {
      const [subj] = await db
        .select({ name: subjects.name })
        .from(subjects)
        .where(eq(subjects.id, p.subjectId))
        .limit(1);
      const [cls] = await db
        .select({ name: classes.name })
        .from(classes)
        .where(eq(classes.id, p.classId))
        .limit(1);

      const name = `${subj?.name ?? "Subject"} · ${cls?.name ?? "Class"} · Tutor`;

      const inserted = await db
        .insert(agents)
        .values({
          name,
          agentRole: "TUTOR",
          instructions: DEFAULT_TUTOR_INSTRUCTIONS,
          subjectId: p.subjectId,
          classId: p.classId,
          voiceId: "marin",
          isActive: true,
        })
        .onConflictDoNothing({
          target: [agents.subjectId, agents.classId, agents.agentRole],
        })
        .returning({ id: agents.id });

      if (inserted.length > 0) created += 1;
    }

    return { created, pairsScanned: pairs.length };
  }),

  updateTutor: adminProcedure
    .input(updateTutorAgentSchema)
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      const keys = Object.keys(patch) as (keyof typeof patch)[];
      if (keys.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update.",
        });
      }

      const [row] = await db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.id, id), eq(agents.agentRole, "TUTOR")))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Tutor not found." });
      }

      const [updated] = await db
        .update(agents)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, id))
        .returning();

      return updated;
    }),
});
