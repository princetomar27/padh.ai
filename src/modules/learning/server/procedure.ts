import { db } from "@/db";
import {
  agents,
  bookPages,
  books,
  chapters,
  classes,
  learningSessions,
  pdfChunks,
} from "@/db/schema";
import { createGeminiLiveSessionForAgent } from "@/lib/gemini/create-live-session";
import { summarizeLearningSession } from "@/lib/openai/session-summary";
import { ingest } from "@/inngest/client";
import { createTRPCRouter, studentProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, or } from "drizzle-orm";
import {
  appendTranscriptSchema,
  chapterIdInputSchema,
  completeSessionSchema,
  sessionIdInputSchema,
  updateProgressSchema,
} from "../schemas";

async function assertStudentOwnsChapter(
  userId: string,
  userClass: number,
  chapterId: string,
) {
  const [row] = await db
    .select({
      chapter: chapters,
      bookId: chapters.bookId,
      bookTitle: books.title,
      subjectId: chapters.subjectId,
      classId: chapters.classId,
      classNumber: classes.number,
    })
    .from(chapters)
    .innerJoin(books, eq(chapters.bookId, books.id))
    .innerJoin(classes, eq(chapters.classId, classes.id))
    .where(eq(chapters.id, chapterId))
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found." });
  }
  if (row.classNumber !== userClass) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This chapter is not for your class.",
    });
  }
  if (!row.chapter.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This chapter is not available.",
    });
  }
  if (row.chapter.processingStatus !== "COMPLETED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This chapter is still being processed.",
    });
  }

  return row;
}

async function assertStudentOwnsSession(userId: string, sessionId: string) {
  const [s] = await db
    .select()
    .from(learningSessions)
    .where(
      and(
        eq(learningSessions.id, sessionId),
        eq(learningSessions.studentId, userId),
      ),
    )
    .limit(1);

  if (!s) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
  }
  return s;
}

export const learningRouter = createTRPCRouter({
  startOrResumeSession: studentProcedure
    .input(chapterIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const row = await assertStudentOwnsChapter(
        ctx.user.id,
        ctx.user.class!,
        input.chapterId,
      );

      const [tutor] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.subjectId, row.subjectId),
            eq(agents.classId, row.classId),
            eq(agents.agentRole, "TUTOR"),
            eq(agents.isActive, true),
          ),
        )
        .limit(1);

      if (!tutor) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "No AI tutor is configured for this subject and class. Ask an admin to run “Seed tutor agents”.",
        });
      }

      const [existing] = await db
        .select()
        .from(learningSessions)
        .where(
          and(
            eq(learningSessions.studentId, ctx.user.id),
            eq(learningSessions.chapterId, input.chapterId),
            or(
              eq(learningSessions.status, "ACTIVE"),
              eq(learningSessions.status, "PAUSED"),
            ),
          ),
        )
        .limit(1);

      if (existing) {
        return { session: existing, resumed: true as const };
      }

      const [created] = await db
        .insert(learningSessions)
        .values({
          studentId: ctx.user.id,
          chapterId: input.chapterId,
          bookId: row.bookId,
          agentId: tutor.id,
          title: row.chapter.title,
          sessionType: "full_explanation",
          status: "ACTIVE",
          startedAt: new Date(),
          currentChunkIndex: 0,
          languagePreference: ctx.user.languagePreference ?? "ENGLISH",
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create session.",
        });
      }

      return { session: created, resumed: false as const };
    }),

  getSession: studentProcedure
    .input(sessionIdInputSchema)
    .query(async ({ ctx, input }) => {
      const s = await assertStudentOwnsSession(ctx.user.id, input.sessionId);
      const [ch] = await db
        .select({
          title: chapters.title,
          bookTitle: books.title,
        })
        .from(chapters)
        .innerJoin(books, eq(chapters.bookId, books.id))
        .where(eq(chapters.id, s.chapterId))
        .limit(1);

      const [agent] = s.agentId
        ? await db
            .select({
              instructions: agents.instructions,
              voiceId: agents.voiceId,
            })
            .from(agents)
            .where(eq(agents.id, s.agentId))
            .limit(1)
        : [null];

      return {
        session: s,
        chapterTitle: ch?.title ?? "",
        bookTitle: ch?.bookTitle ?? "",
        agent: agent ?? null,
      };
    }),

  getSessionChunks: studentProcedure
    .input(sessionIdInputSchema)
    .query(async ({ ctx, input }) => {
      const s = await assertStudentOwnsSession(ctx.user.id, input.sessionId);

      const rows = await db
        .select({
          id: pdfChunks.id,
          orderInChapter: pdfChunks.orderInChapter,
          speakText: pdfChunks.speakText,
          text: pdfChunks.text,
          boundingBoxes: pdfChunks.boundingBoxes,
          isEquation: pdfChunks.isEquation,
          isImage: pdfChunks.isImage,
          pageNumber: bookPages.pageNumber,
          imageUrl: bookPages.imageUrl,
          bookPageId: bookPages.id,
        })
        .from(pdfChunks)
        .innerJoin(bookPages, eq(pdfChunks.bookPageId, bookPages.id))
        .where(eq(pdfChunks.chapterId, s.chapterId))
        .orderBy(asc(pdfChunks.orderInChapter));

      return { chunks: rows };
    }),

  updateProgress: studentProcedure
    .input(updateProgressSchema)
    .mutation(async ({ ctx, input }) => {
      const s = await assertStudentOwnsSession(ctx.user.id, input.sessionId);
      if (s.status !== "ACTIVE" && s.status !== "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Session is not active.",
        });
      }

      const visited = Array.isArray(s.chunksVisited)
        ? ([...(s.chunksVisited as string[])] as string[])
        : [];
      if (!visited.includes(input.chunkId)) {
        visited.push(input.chunkId);
      }

      await db
        .update(learningSessions)
        .set({
          currentChunkId: input.chunkId,
          currentChunkIndex: input.orderInChapter,
          chunksVisited: visited,
          updatedAt: new Date(),
        })
        .where(eq(learningSessions.id, input.sessionId));

      return { ok: true as const };
    }),

  appendTranscript: studentProcedure
    .input(appendTranscriptSchema)
    .mutation(async ({ ctx, input }) => {
      await assertStudentOwnsSession(ctx.user.id, input.sessionId);
      const [cur] = await db
        .select({ transcript: learningSessions.transcript })
        .from(learningSessions)
        .where(eq(learningSessions.id, input.sessionId))
        .limit(1);

      const next = `${cur?.transcript ?? ""}${input.delta}`;
      const capped = next.length > 500_000 ? next.slice(-500_000) : next;

      await db
        .update(learningSessions)
        .set({
          transcript: capped,
          updatedAt: new Date(),
        })
        .where(eq(learningSessions.id, input.sessionId));

      return { ok: true as const };
    }),

  pauseSession: studentProcedure
    .input(sessionIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertStudentOwnsSession(ctx.user.id, input.sessionId);
      await db
        .update(learningSessions)
        .set({ status: "PAUSED", updatedAt: new Date() })
        .where(eq(learningSessions.id, input.sessionId));
      return { ok: true as const };
    }),

  resumeSession: studentProcedure
    .input(sessionIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const s = await assertStudentOwnsSession(ctx.user.id, input.sessionId);
      if (s.status !== "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only a paused session can be resumed.",
        });
      }
      await db
        .update(learningSessions)
        .set({ status: "ACTIVE", updatedAt: new Date() })
        .where(eq(learningSessions.id, input.sessionId));
      return { ok: true as const };
    }),

  completeSession: studentProcedure
    .input(completeSessionSchema)
    .mutation(async ({ ctx, input }) => {
      const s = await assertStudentOwnsSession(ctx.user.id, input.sessionId);
      if (s.status === "COMPLETED") {
        return { session: s };
      }

      const endedAt = new Date();
      const started = s.startedAt?.getTime() ?? endedAt.getTime();
      const durationSeconds = Math.max(
        0,
        Math.round((endedAt.getTime() - started) / 1000),
      );

      const [meta] = await db
        .select({
          chapterTitle: chapters.title,
          bookTitle: books.title,
        })
        .from(chapters)
        .innerJoin(books, eq(chapters.bookId, books.id))
        .where(eq(chapters.id, s.chapterId))
        .limit(1);

      let summary: string | null = null;
      let aiNotes: string | null = null;

      const canSummarize =
        Boolean(process.env.OPENAI_API_KEY?.trim()) ||
        Boolean(process.env.GROQ_API_KEY?.trim());

      if (canSummarize) {
        try {
          const out = await summarizeLearningSession({
            chapterTitle: meta?.chapterTitle ?? "",
            bookTitle: meta?.bookTitle ?? "",
            transcript: s.transcript,
          });
          summary = out.summary;
          aiNotes = out.aiNotes;
        } catch (e) {
          console.error("[completeSession] summary failed:", e);
          summary =
            "Session saved. Open your chapter in Study materials to keep reviewing.";
          aiNotes = null;
          void ingest
            .send({
              name: "padhai/session.summarize",
              data: { sessionId: input.sessionId },
            })
            .catch((sendErr) =>
              console.error("[completeSession] inngest send failed:", sendErr),
            );
        }
      } else {
        summary =
          "Session complete. Continue reading the chapter in Study materials.";
      }

      const [updated] = await db
        .update(learningSessions)
        .set({
          status: "COMPLETED",
          endedAt,
          durationSeconds,
          summary,
          aiNotes,
          currentChunkId: null,
          studentFeedback: input.studentFeedback ?? s.studentFeedback,
          updatedAt: new Date(),
        })
        .where(eq(learningSessions.id, input.sessionId))
        .returning();

      const [chFlags] = await db
        .select({ questionsGenerated: chapters.questionsGenerated })
        .from(chapters)
        .where(eq(chapters.id, s.chapterId))
        .limit(1);

      if (!chFlags?.questionsGenerated) {
        void ingest
          .send({
            name: "padhai/chapter.generateImportantQuestions",
            data: { chapterId: s.chapterId },
          })
          .catch((sendErr) =>
            console.error(
              "[completeSession] important-questions enqueue failed:",
              sendErr,
            ),
          );
      }

      return { session: updated! };
    }),

  getGeminiLiveSession: studentProcedure
    .input(sessionIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const s = await assertStudentOwnsSession(ctx.user.id, input.sessionId);
      if (s.status !== "ACTIVE" && s.status !== "PAUSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Start or resume the session first.",
        });
      }

      if (!s.agentId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Session has no tutor agent.",
        });
      }

      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, s.agentId))
        .limit(1);

      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tutor agent not found.",
        });
      }

      try {
        const [chMeta] = await db
          .select({
            chapterTitle: chapters.title,
            bookTitle: books.title,
          })
          .from(chapters)
          .innerJoin(books, eq(chapters.bookId, books.id))
          .where(eq(chapters.id, s.chapterId))
          .limit(1);

        const chapterTitle = chMeta?.chapterTitle ?? "this chapter";
        const bookTitle = chMeta?.bookTitle ?? "the textbook";

        const creds = await createGeminiLiveSessionForAgent({
          agentInstructions: agent.instructions,
          chapterTitle,
          bookTitle,
        });

        return {
          accessToken: creds.accessToken,
          model: creds.model,
          modelResource: creds.modelResource,
          voiceName: creds.voiceName,
          setupMessage: creds.setupMessage,
          kickoffClientMessage: creds.kickoffClientMessage,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Could not start voice session: ${msg}`,
        });
      }
    }),

  listMySessions: studentProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: learningSessions.id,
        title: learningSessions.title,
        status: learningSessions.status,
        startedAt: learningSessions.startedAt,
        endedAt: learningSessions.endedAt,
        durationSeconds: learningSessions.durationSeconds,
        summary: learningSessions.summary,
        chapterId: learningSessions.chapterId,
        chapterTitle: chapters.title,
      })
      .from(learningSessions)
      .innerJoin(chapters, eq(learningSessions.chapterId, chapters.id))
      .where(eq(learningSessions.studentId, ctx.user.id))
      .orderBy(desc(learningSessions.createdAt));
  }),
});
