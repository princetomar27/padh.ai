import { db } from "@/db";
import {
  bookPages,
  books,
  chapters,
  classes,
  pdfChunks,
  subjects,
} from "@/db/schema";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gt, gte, lte } from "drizzle-orm";
import {
  chapterIdInputSchema,
  readerChunksInputSchema,
  updateChapterInputSchema,
} from "../schemas";

async function assertChapterReaderAccess(opts: {
  userRole: "STUDENT" | "PARENT" | "ADMIN";
  userClass: number | null;
  chapterId: string;
}) {
  const [row] = await db
    .select({
      id: chapters.id,
      title: chapters.title,
      chapterNumber: chapters.chapterNumber,
      startPage: chapters.startPage,
      endPage: chapters.endPage,
      description: chapters.description,
      objectives: chapters.objectives,
      duration: chapters.duration,
      processingStatus: chapters.processingStatus,
      totalChunks: chapters.totalChunks,
      isActive: chapters.isActive,
      questionsGenerated: chapters.questionsGenerated,
      bookId: chapters.bookId,
      bookTitle: books.title,
      subjectId: subjects.id,
      subjectName: subjects.name,
      classId: classes.id,
      classNumber: classes.number,
      className: classes.name,
    })
    .from(chapters)
    .innerJoin(books, eq(chapters.bookId, books.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .innerJoin(classes, eq(chapters.classId, classes.id))
    .where(eq(chapters.id, opts.chapterId))
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found." });
  }

  if (opts.userRole === "ADMIN") {
    return row;
  }

  if (opts.userRole === "PARENT") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Parents cannot open chapter reader content.",
    });
  }

  if (opts.userRole !== "STUDENT") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
  }

  if (opts.userClass == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Set your class in onboarding to view chapters.",
    });
  }

  if (row.classNumber !== opts.userClass) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This chapter is not available for your class.",
    });
  }

  if (!row.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This chapter is not available.",
    });
  }

  if (row.processingStatus !== "COMPLETED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This chapter is still being processed.",
    });
  }

  return row;
}

export const chaptersRouter = createTRPCRouter({
  listForAdmin: adminProcedure.query(async () => {
    return db
      .select({
        id: chapters.id,
        title: chapters.title,
        chapterNumber: chapters.chapterNumber,
        startPage: chapters.startPage,
        endPage: chapters.endPage,
        description: chapters.description,
        duration: chapters.duration,
        processingStatus: chapters.processingStatus,
        totalChunks: chapters.totalChunks,
        isActive: chapters.isActive,
        bookId: books.id,
        bookTitle: books.title,
        subjectName: subjects.name,
        className: classes.name,
      })
      .from(chapters)
      .innerJoin(books, eq(chapters.bookId, books.id))
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .innerJoin(classes, eq(chapters.classId, classes.id))
      .orderBy(asc(books.title), asc(chapters.chapterNumber));
  }),

  getByIdForAdmin: adminProcedure
    .input(chapterIdInputSchema)
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          id: chapters.id,
          title: chapters.title,
          chapterNumber: chapters.chapterNumber,
          startPage: chapters.startPage,
          endPage: chapters.endPage,
          description: chapters.description,
          objectives: chapters.objectives,
          duration: chapters.duration,
          processingStatus: chapters.processingStatus,
          totalChunks: chapters.totalChunks,
          isActive: chapters.isActive,
          questionsGenerated: chapters.questionsGenerated,
          bookId: books.id,
          bookTitle: books.title,
          bookTotalPages: books.totalPages,
          subjectName: subjects.name,
          className: classes.name,
        })
        .from(chapters)
        .innerJoin(books, eq(chapters.bookId, books.id))
        .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
        .innerJoin(classes, eq(chapters.classId, classes.id))
        .where(eq(chapters.id, input.id))
        .limit(1);

      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found." });
      }

      return row;
    }),

  updateChapter: adminProcedure
    .input(updateChapterInputSchema)
    .mutation(async ({ input }) => {
      const { id, ...patch } = input;
      const keys = Object.keys(patch) as (keyof typeof patch)[];
      if (keys.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update.",
        });
      }

      const [existing] = await db
        .select({ id: chapters.id })
        .from(chapters)
        .where(eq(chapters.id, id))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found." });
      }

      const [updated] = await db
        .update(chapters)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(chapters.id, id))
        .returning();

      return updated;
    }),

  /**
   * Paginated speakText chunks for the chapter reader (admin + student).
   * Students only see chapters for their class that are active and completed.
   */
  getReaderChunks: protectedProcedure
    .input(readerChunksInputSchema)
    .query(async ({ ctx, input }) => {
      await assertChapterReaderAccess({
        userRole: ctx.user.role,
        userClass: ctx.user.class,
        chapterId: input.chapterId,
      });

      const rows = await db
        .select({
          id: pdfChunks.id,
          orderInChapter: pdfChunks.orderInChapter,
          speakText: pdfChunks.speakText,
          pageNumber: bookPages.pageNumber,
        })
        .from(pdfChunks)
        .innerJoin(bookPages, eq(pdfChunks.bookPageId, bookPages.id))
        .where(
          and(
            eq(pdfChunks.chapterId, input.chapterId),
            gt(pdfChunks.orderInChapter, input.afterOrder),
          ),
        )
        .orderBy(asc(pdfChunks.orderInChapter))
        .limit(input.limit);

      const nextAfterOrder =
        rows.length === input.limit
          ? rows[rows.length - 1]!.orderInChapter
          : null;

      return { chunks: rows, nextAfterOrder };
    }),

  getReaderMeta: protectedProcedure
    .input(chapterIdInputSchema)
    .query(async ({ ctx, input }) => {
      const chapter = await assertChapterReaderAccess({
        userRole: ctx.user.role,
        userClass: ctx.user.class,
        chapterId: input.id,
      });

      return {
        viewerRole: ctx.user.role,
        chapter: {
          id: chapter.id,
          title: chapter.title,
          chapterNumber: chapter.chapterNumber,
          startPage: chapter.startPage,
          endPage: chapter.endPage,
          description: chapter.description,
          objectives: chapter.objectives,
          duration: chapter.duration,
          totalChunks: chapter.totalChunks,
          processingStatus: chapter.processingStatus,
          bookTitle: chapter.bookTitle,
          subjectName: chapter.subjectName,
          className: chapter.className,
        },
      };
    }),

  /**
   * Rendered PDF page images for the chapter span (Vercel Blob URLs).
   * Used by the split reader: textbook panel + processed segments + scroll sync.
   */
  getReaderBookPages: protectedProcedure
    .input(chapterIdInputSchema)
    .query(async ({ ctx, input }) => {
      const ch = await assertChapterReaderAccess({
        userRole: ctx.user.role,
        userClass: ctx.user.class,
        chapterId: input.id,
      });

      const pages = await db
        .select({
          pageNumber: bookPages.pageNumber,
          imageUrl: bookPages.imageUrl,
        })
        .from(bookPages)
        .where(
          and(
            eq(bookPages.bookId, ch.bookId),
            gte(bookPages.pageNumber, ch.startPage),
            lte(bookPages.pageNumber, ch.endPage),
          ),
        )
        .orderBy(asc(bookPages.pageNumber));

      return { pages };
    }),

  /** Student study hub: completed, active chapters for the learner's class. */
  listForStudy: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role !== "STUDENT") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only students can open the study catalog.",
      });
    }
    if (ctx.user.class == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Set your class in onboarding to browse chapters.",
      });
    }

    return db
      .select({
        id: chapters.id,
        title: chapters.title,
        chapterNumber: chapters.chapterNumber,
        startPage: chapters.startPage,
        endPage: chapters.endPage,
        description: chapters.description,
        duration: chapters.duration,
        totalChunks: chapters.totalChunks,
        processingStatus: chapters.processingStatus,
        bookTitle: books.title,
        subjectName: subjects.name,
        className: classes.name,
      })
      .from(chapters)
      .innerJoin(books, eq(chapters.bookId, books.id))
      .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
      .innerJoin(classes, eq(chapters.classId, classes.id))
      .where(
        and(
          eq(classes.number, ctx.user.class),
          eq(chapters.isActive, true),
          eq(chapters.processingStatus, "COMPLETED"),
        ),
      )
      .orderBy(asc(subjects.name), asc(chapters.chapterNumber));
  }),
});
