import { db } from "@/db";
import {
  agents,
  bookPages,
  books,
  chapters,
  classes,
  importantQuestions,
  learningSessions,
  pdfChunks,
  questions,
  subjects,
  tests,
} from "@/db/schema";
import {
  createGeminiLiveSessionForAgent,
  type GeminiLiveLessonContext,
} from "@/lib/gemini/create-live-session";
import { ensureTutorAgentForSubjectClass } from "@/modules/agents/server/ensure-tutor";
import { summarizeLearningSession } from "@/lib/openai/session-summary";
import { ingest } from "@/inngest/client";
import { createTRPCRouter, studentProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
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

      await ensureTutorAgentForSubjectClass({
        subjectId: row.subjectId,
        classId: row.classId,
      });

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
            "Could not create or load the AI tutor for this subject and class. Ask an admin to check agents configuration.",
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
          startPage: chapters.startPage,
          endPage: chapters.endPage,
          chapterIngestSources: books.chapterIngestSources,
        })
        .from(chapters)
        .innerJoin(books, eq(chapters.bookId, books.id))
        .where(eq(chapters.id, s.chapterId))
        .limit(1);

      const pdfReaderMode =
        Array.isArray(ch?.chapterIngestSources) &&
        ch.chapterIngestSources.length > 0
          ? ("chapter_file" as const)
          : ("book_file" as const);

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
        reader: {
          chapterId: s.chapterId,
          startPage: ch?.startPage ?? 1,
          endPage: ch?.endPage ?? 1,
          pdfReaderMode,
        },
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
            chapterNumber: chapters.chapterNumber,
            startPage: chapters.startPage,
            endPage: chapters.endPage,
            description: chapters.description,
            objectives: chapters.objectives,
          })
          .from(chapters)
          .innerJoin(books, eq(chapters.bookId, books.id))
          .where(eq(chapters.id, s.chapterId))
          .limit(1);

        const iqRows = await db
          .select({
            questionText: importantQuestions.questionText,
            difficulty: importantQuestions.difficulty,
          })
          .from(importantQuestions)
          .where(
            and(
              eq(importantQuestions.chapterId, s.chapterId),
              eq(importantQuestions.isActive, true),
            ),
          )
          .orderBy(asc(importantQuestions.orderInChapter))
          .limit(10);

        const chunkFields = {
          orderInChapter: pdfChunks.orderInChapter,
          pageNumber: bookPages.pageNumber,
          speakText: pdfChunks.speakText,
          text: pdfChunks.text,
        };

        let [atChunk] = s.currentChunkId
          ? await db
              .select(chunkFields)
              .from(pdfChunks)
              .innerJoin(bookPages, eq(pdfChunks.bookPageId, bookPages.id))
              .where(eq(pdfChunks.id, s.currentChunkId))
              .limit(1)
          : [];

        if (!atChunk && s.currentChunkIndex != null) {
          [atChunk] = await db
            .select(chunkFields)
            .from(pdfChunks)
            .innerJoin(bookPages, eq(pdfChunks.bookPageId, bookPages.id))
            .where(
              and(
                eq(pdfChunks.chapterId, s.chapterId),
                eq(pdfChunks.orderInChapter, s.currentChunkIndex),
              ),
            )
            .limit(1);
        }

        if (!atChunk) {
          [atChunk] = await db
            .select(chunkFields)
            .from(pdfChunks)
            .innerJoin(bookPages, eq(pdfChunks.bookPageId, bookPages.id))
            .where(eq(pdfChunks.chapterId, s.chapterId))
            .orderBy(asc(pdfChunks.orderInChapter))
            .limit(1);
        }

        const previewRaw = (atChunk?.speakText ?? atChunk?.text ?? "").trim();
        const preview =
          previewRaw.length > 1800
            ? `${previewRaw.slice(0, 1799)}…`
            : previewRaw;

        const lesson: GeminiLiveLessonContext = {
          chapterTitle: chMeta?.chapterTitle ?? "this chapter",
          bookTitle: chMeta?.bookTitle ?? "the textbook",
          chapterNumber: chMeta?.chapterNumber ?? null,
          chapterPdfStartPage: chMeta?.startPage ?? 1,
          chapterPdfEndPage: chMeta?.endPage ?? 1,
          description: chMeta?.description ?? null,
          objectives: chMeta?.objectives ?? null,
          importantQuestions: iqRows.map((q) => ({
            questionText: q.questionText,
            difficulty: q.difficulty != null ? String(q.difficulty) : null,
          })),
          currentOrderInChapter: atChunk?.orderInChapter ?? 0,
          currentSegmentDisplayOneBased: (atChunk?.orderInChapter ?? 0) + 1,
          currentPdfPage: atChunk?.pageNumber ?? chMeta?.startPage ?? 1,
          currentSegmentPreview: preview || "(empty segment)",
        };

        const creds = await createGeminiLiveSessionForAgent({
          agentInstructions: agent.instructions,
          lesson,
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

  /** Mock tests available for the student’s class (for dashboard cards). */
  listAvailableTests: studentProcedure.query(async ({ ctx }) => {
    const [cls] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.number, ctx.user.class!))
      .limit(1);

    if (!cls) return [];

    const testRows = await db
      .select({
        id: tests.id,
        title: tests.title,
        duration: tests.duration,
        subjectName: subjects.name,
        chapterTitle: chapters.title,
        chapterId: chapters.id,
      })
      .from(tests)
      .innerJoin(chapters, eq(tests.chapterId, chapters.id))
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .where(
        and(
          eq(chapters.classId, cls.id),
          eq(tests.isActive, true),
          eq(chapters.isActive, true),
        ),
      )
      .orderBy(desc(tests.createdAt))
      .limit(24);

    if (testRows.length === 0) return [];

    const testIds = testRows.map((t) => t.id);
    const qRows = await db
      .select({
        testId: questions.testId,
        difficulty: questions.difficulty,
      })
      .from(questions)
      .where(
        and(inArray(questions.testId, testIds), eq(questions.isActive, true)),
      );

    const rank: Record<string, number> = { EASY: 0, MEDIUM: 1, HARD: 2 };
    const byTest = new Map<string, string[]>();
    for (const q of qRows) {
      const list = byTest.get(q.testId) ?? [];
      list.push(q.difficulty);
      byTest.set(q.testId, list);
    }

    function aggregateDifficulty(ds: string[]) {
      if (ds.length === 0) return "MEDIUM" as const;
      let best = ds[0]!;
      let r = rank[best] ?? 1;
      for (const d of ds) {
        const rr = rank[d] ?? 1;
        if (rr > r) {
          best = d;
          r = rr;
        }
      }
      return best as "EASY" | "MEDIUM" | "HARD";
    }

    return testRows.map((t) => ({
      ...t,
      questionCount: byTest.get(t.id)?.length ?? 0,
      difficulty: aggregateDifficulty(byTest.get(t.id) ?? []),
    }));
  }),
});
