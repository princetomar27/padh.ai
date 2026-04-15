import "server-only";

import { db } from "@/db";
import { agents, classes, subjects } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { DEFAULT_TUTOR_INSTRUCTIONS } from "../constants";

/**
 * Ensures an active TUTOR agent exists for the given subject + class (same rules as
 * admin `seedMissingTutors`, but for a single pair). Used when a student starts a
 * session so local dev does not require manually seeding tutors first.
 */
export async function ensureTutorAgentForSubjectClass(opts: {
  subjectId: string;
  classId: string;
}): Promise<void> {
  const [existing] = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.subjectId, opts.subjectId),
        eq(agents.classId, opts.classId),
        eq(agents.agentRole, "TUTOR"),
      ),
    )
    .limit(1);

  if (existing) {
    if (!existing.isActive) {
      await db
        .update(agents)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(agents.id, existing.id));
    }
    return;
  }

  const [subj] = await db
    .select({ name: subjects.name })
    .from(subjects)
    .where(eq(subjects.id, opts.subjectId))
    .limit(1);
  const [cls] = await db
    .select({ name: classes.name })
    .from(classes)
    .where(eq(classes.id, opts.classId))
    .limit(1);

  const name = `${subj?.name ?? "Subject"} · ${cls?.name ?? "Class"} · Tutor`;

  await db
    .insert(agents)
    .values({
      name,
      agentRole: "TUTOR",
      instructions: DEFAULT_TUTOR_INSTRUCTIONS,
      subjectId: opts.subjectId,
      classId: opts.classId,
      voiceId: "marin",
      isActive: true,
    })
    .onConflictDoNothing({
      target: [agents.subjectId, agents.classId, agents.agentRole],
    });
}
