import { db } from "@/db";
import { books, chapters, importantQuestions, pdfChunks } from "@/db/schema";
import { generateImportantQuestionsFromChapterText } from "@/lib/openai/generate-important-questions";
import { ingest } from "@/inngest/client";
import { and, asc, eq } from "drizzle-orm";
import { NonRetriableError } from "inngest";

export type GenerateImportantQuestionsEvent = {
  name: "padhai/chapter.generateImportantQuestions";
  data: {
    chapterId: string;
  };
};

export const generateImportantQuestions = ingest.createFunction(
  {
    id: "generate-important-questions",
    name: "Generate important questions for chapter",
    retries: 2,
  },
  { event: "padhai/chapter.generateImportantQuestions" },
  async ({ event, step }) => {
    const chapterId = event.data.chapterId;

    const gate = await step.run("load-chapter", async () => {
      const [ch] = await db
        .select({
          id: chapters.id,
          title: chapters.title,
          bookId: chapters.bookId,
          questionsGenerated: chapters.questionsGenerated,
          processingStatus: chapters.processingStatus,
        })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .limit(1);

      if (!ch) {
        throw new NonRetriableError(`Chapter not found: ${chapterId}`);
      }
      if (ch.processingStatus !== "COMPLETED") {
        return { skip: true as const, reason: "not-completed" };
      }
      if (ch.questionsGenerated) {
        return { skip: true as const, reason: "already-generated" };
      }

      const [book] = await db
        .select({ title: books.title })
        .from(books)
        .where(eq(books.id, ch.bookId))
        .limit(1);

      const chunkRows = await db
        .select({ speakText: pdfChunks.speakText, text: pdfChunks.text })
        .from(pdfChunks)
        .where(eq(pdfChunks.chapterId, chapterId))
        .orderBy(asc(pdfChunks.orderInChapter))
        .limit(200);

      const excerpt = chunkRows
        .map((r) => (r.speakText || r.text || "").trim())
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 120_000);

      return {
        skip: false as const,
        chapterTitle: ch.title,
        bookTitle: book?.title ?? "",
        excerpt,
      };
    });

    if (gate.skip) {
      return { ok: true as const, chapterId, skipped: gate.reason };
    }

    if (
      !process.env.OPENAI_API_KEY?.trim() &&
      !process.env.GROQ_API_KEY?.trim()
    ) {
      throw new NonRetriableError(
        "Set OPENAI_API_KEY or GROQ_API_KEY for question generation",
      );
    }

    const generated = await step.run("openai-generate", async () => {
      return generateImportantQuestionsFromChapterText({
        chapterTitle: gate.chapterTitle,
        bookTitle: gate.bookTitle,
        chunkExcerpt: gate.excerpt,
      });
    });

    await step.run("persist", async () => {
      const [fresh] = await db
        .select({ questionsGenerated: chapters.questionsGenerated })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .limit(1);
      if (fresh?.questionsGenerated) {
        return;
      }

      if (generated.length === 0) {
        await db
          .update(chapters)
          .set({ questionsGenerated: true, updatedAt: new Date() })
          .where(
            and(
              eq(chapters.id, chapterId),
              eq(chapters.questionsGenerated, false),
            ),
          );
        return;
      }

      const rows = generated.map((q, i) => {
        const optionsValue =
          q.questionType === "MCQ" && q.options && q.correctIndex != null
            ? {
                options: q.options,
                correctIndex: q.correctIndex,
              }
            : null;

        return {
          chapterId,
          questionText: q.questionText.slice(0, 4000),
          questionType: q.questionType,
          options: optionsValue,
          correctAnswer: q.correctAnswer.slice(0, 4000),
          explanation: q.explanation?.slice(0, 8000) ?? null,
          marks: 1,
          difficulty: q.difficulty,
          source: "AI_GENERATED" as const,
          orderInChapter: i,
          isActive: true,
        };
      });

      await db.insert(importantQuestions).values(rows);
      await db
        .update(chapters)
        .set({ questionsGenerated: true, updatedAt: new Date() })
        .where(eq(chapters.id, chapterId));
    });

    return { ok: true as const, chapterId, count: generated.length };
  },
);
