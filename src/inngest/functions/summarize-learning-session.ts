import { db } from "@/db";
import { books, chapters, learningSessions } from "@/db/schema";
import { summarizeLearningSession } from "@/lib/openai/session-summary";
import { ingest } from "@/inngest/client";
import { eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";

export type SummarizeLearningSessionEvent = {
  name: "padhai/session.summarize";
  data: {
    sessionId: string;
  };
};

const FALLBACK_PREFIX = "Session saved.";

export const summarizeLearningSessionFn = ingest.createFunction(
  {
    id: "summarize-learning-session",
    name: "Summarize learning session (async backfill)",
    retries: 3,
  },
  { event: "padhai/session.summarize" },
  async ({ event, step }) => {
    const sessionId = event.data.sessionId;

    const snapshot = await step.run("load-session", async () => {
      const [s] = await db
        .select()
        .from(learningSessions)
        .where(eq(learningSessions.id, sessionId))
        .limit(1);

      if (!s) {
        throw new NonRetriableError(`Session not found: ${sessionId}`);
      }
      if (s.status !== "COMPLETED") {
        return { skip: true as const, reason: "not-completed" };
      }

      if (s.summary && !s.summary.startsWith(FALLBACK_PREFIX)) {
        return { skip: true as const, reason: "already-summarized" };
      }

      const [meta] = await db
        .select({
          chapterTitle: chapters.title,
          bookTitle: books.title,
        })
        .from(chapters)
        .innerJoin(books, eq(chapters.bookId, books.id))
        .where(eq(chapters.id, s.chapterId))
        .limit(1);

      return {
        skip: false as const,
        transcript: s.transcript,
        chapterTitle: meta?.chapterTitle ?? "",
        bookTitle: meta?.bookTitle ?? "",
      };
    });

    if (snapshot.skip) {
      return { ok: true as const, sessionId, skipped: snapshot.reason };
    }

    if (
      !process.env.OPENAI_API_KEY?.trim() &&
      !process.env.GROQ_API_KEY?.trim()
    ) {
      throw new NonRetriableError(
        "Set OPENAI_API_KEY or GROQ_API_KEY for session summary",
      );
    }

    const out = await step.run("openai-summarize", async () => {
      return summarizeLearningSession({
        chapterTitle: snapshot.chapterTitle,
        bookTitle: snapshot.bookTitle,
        transcript: snapshot.transcript,
      });
    });

    await step.run("persist", async () => {
      await db
        .update(learningSessions)
        .set({
          summary: out.summary,
          aiNotes: out.aiNotes,
          updatedAt: new Date(),
        })
        .where(eq(learningSessions.id, sessionId));
    });

    return { ok: true as const, sessionId };
  },
);
