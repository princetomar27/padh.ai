import { db } from "@/db";
import {
  bookPages,
  books,
  chapters,
  classSubjects,
  classes,
  learningSessions,
  pdfChunks,
  studentProgress,
  subjects,
  testAttempts,
} from "@/db/schema";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
  studentProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  lte,
} from "drizzle-orm";
import {
  chapterIdInputSchema,
  readerChunksInputSchema,
  updateChapterInputSchema,
} from "../schemas";
import { assertChapterReaderAccess } from "./chapter-reader-access";

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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chapter not found.",
        });
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
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chapter not found.",
        });
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

      const [bookRow] = await db
        .select({ chapterIngestSources: books.chapterIngestSources })
        .from(books)
        .where(eq(books.id, chapter.bookId))
        .limit(1);

      const pdfReaderMode =
        Array.isArray(bookRow?.chapterIngestSources) &&
        bookRow.chapterIngestSources.length > 0
          ? ("chapter_file" as const)
          : ("book_file" as const);

      return {
        viewerRole: ctx.user.role,
        pdfReaderMode,
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

  /**
   * Full student catalog: subjects → books → chapters with session/progress hints
   * for the dashboard, subject page, and book chapter list.
   */
  studentLearningTree: studentProcedure.query(async ({ ctx }) => {
    const [cls] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.number, ctx.user.class ?? 0))
      .limit(1);

    if (!cls) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Class not found." });
    }

    const subjectRows = await db
      .select({
        id: subjects.id,
        name: subjects.name,
        icon: subjects.icon,
        color: subjects.color,
      })
      .from(classSubjects)
      .innerJoin(subjects, eq(classSubjects.subjectId, subjects.id))
      .where(
        and(
          eq(classSubjects.classId, cls.id),
          eq(classSubjects.isActive, true),
          eq(subjects.isActive, true),
        ),
      )
      .orderBy(asc(subjects.name));

    const bookRows = await db
      .select({
        id: books.id,
        title: books.title,
        subjectId: books.subjectId,
        processingStatus: books.processingStatus,
      })
      .from(books)
      .where(and(eq(books.classId, cls.id), eq(books.isActive, true)))
      .orderBy(asc(books.title));

    const chapterRows = await db
      .select({
        id: chapters.id,
        bookId: chapters.bookId,
        title: chapters.title,
        chapterNumber: chapters.chapterNumber,
        processingStatus: chapters.processingStatus,
        totalChunks: chapters.totalChunks,
      })
      .from(chapters)
      .where(and(eq(chapters.classId, cls.id), eq(chapters.isActive, true)))
      .orderBy(asc(chapters.bookId), asc(chapters.chapterNumber));

    const chapterIds = chapterRows.map((c) => c.id);

    const progressRows =
      chapterIds.length === 0
        ? []
        : await db
            .select({
              chapterId: studentProgress.chapterId,
              completionPercentage: studentProgress.completionPercentage,
              lastAccessedAt: studentProgress.lastAccessedAt,
            })
            .from(studentProgress)
            .where(
              and(
                eq(studentProgress.studentId, ctx.user.id),
                inArray(studentProgress.chapterId, chapterIds),
              ),
            );

    const progressPctByChapter = new Map<string, number>();
    const lastAccessByChapter = new Map<string, Date>();
    for (const p of progressRows) {
      progressPctByChapter.set(p.chapterId, p.completionPercentage ?? 0);
      if (p.lastAccessedAt) {
        lastAccessByChapter.set(p.chapterId, p.lastAccessedAt);
      }
    }

    const sessionRows =
      chapterIds.length === 0
        ? []
        : await db
            .select({
              chapterId: learningSessions.chapterId,
              status: learningSessions.status,
              updatedAt: learningSessions.updatedAt,
            })
            .from(learningSessions)
            .where(
              and(
                eq(learningSessions.studentId, ctx.user.id),
                inArray(learningSessions.chapterId, chapterIds),
              ),
            )
            .orderBy(desc(learningSessions.updatedAt));

    const latestSessionByChapter = new Map<
      string,
      (typeof sessionRows)[number]
    >();
    for (const s of sessionRows) {
      if (!latestSessionByChapter.has(s.chapterId)) {
        latestSessionByChapter.set(s.chapterId, s);
      }
    }

    const chapterToBook = new Map(
      chapterRows.map((c) => [c.id, c.bookId] as const),
    );

    const lastAccessByBook = new Map<string, Date>();
    for (const c of chapterRows) {
      const la = lastAccessByChapter.get(c.id);
      if (!la) continue;
      const bid = c.bookId;
      const prev = lastAccessByBook.get(bid);
      if (!prev || la > prev) lastAccessByBook.set(bid, la);
    }

    function buildChapterNode(c: (typeof chapterRows)[number]) {
      const sess = latestSessionByChapter.get(c.id);
      const completed = sess?.status === "COMPLETED";
      const inProgress = sess?.status === "ACTIVE" || sess?.status === "PAUSED";
      const fromProgress = progressPctByChapter.get(c.id) ?? 0;
      const progressPercent = completed
        ? 100
        : Math.round(Math.min(99, Math.max(0, fromProgress)));
      return {
        chapterId: c.id,
        title: c.title,
        chapterNumber: c.chapterNumber,
        processingStatus: c.processingStatus,
        totalChunks: c.totalChunks,
        isReadable: c.processingStatus === "COMPLETED",
        completed,
        isInSession: inProgress && !completed,
        progressPercent,
      };
    }

    const booksBySubject = new Map<string, typeof bookRows>();
    for (const b of bookRows) {
      const list = booksBySubject.get(b.subjectId) ?? [];
      list.push(b);
      booksBySubject.set(b.subjectId, list);
    }

    const chaptersByBook = new Map<string, typeof chapterRows>();
    for (const c of chapterRows) {
      const list = chaptersByBook.get(c.bookId) ?? [];
      list.push(c);
      chaptersByBook.set(c.bookId, list);
    }

    const subjectsOut = subjectRows.map((subj) => {
      const subBooks = booksBySubject.get(subj.id) ?? [];
      const bookNodes = subBooks.map((b) => {
        const rawChs = chaptersByBook.get(b.id) ?? [];
        const chs = rawChs.map(buildChapterNode);
        const completedCount = chs.filter((x) => x.completed).length;
        const totalCh = chs.length;
        const inSession = chs.find((x) => x.isInSession);
        const resume =
          inSession ?? chs.find((x) => !x.completed && x.isReadable) ?? null;
        const progressPercent =
          totalCh === 0 ? 0 : Math.round((completedCount / totalCh) * 100);

        return {
          id: b.id,
          title: b.title,
          subjectId: b.subjectId,
          processingStatus: b.processingStatus,
          chapters: chs,
          completedCount,
          totalChapters: totalCh,
          resumeChapterNumber: resume?.chapterNumber ?? null,
          lastStudiedAt: lastAccessByBook.get(b.id)?.toISOString() ?? null,
          progressPercent,
        };
      });

      let totalCh = 0;
      let completedCh = 0;
      for (const bn of bookNodes) {
        totalCh += bn.totalChapters;
        completedCh += bn.completedCount;
      }
      const progressPercent =
        totalCh === 0 ? 0 : Math.round((completedCh / totalCh) * 100);

      return {
        id: subj.id,
        name: subj.name,
        icon: subj.icon,
        color: subj.color,
        books: bookNodes,
        bookCount: bookNodes.length,
        completedChapters: completedCh,
        totalChapters: totalCh,
        progressPercent,
      };
    });

    const [[testsTakenRow], [avgScoreRow]] = await Promise.all([
      db
        .select({ n: count() })
        .from(testAttempts)
        .where(
          and(
            eq(testAttempts.studentId, ctx.user.id),
            isNotNull(testAttempts.submittedAt),
          ),
        ),
      db
        .select({ avg: avg(testAttempts.percentage) })
        .from(testAttempts)
        .where(
          and(
            eq(testAttempts.studentId, ctx.user.id),
            isNotNull(testAttempts.submittedAt),
          ),
        ),
    ]);

    const booksWithActivity = new Set<string>();
    for (const s of sessionRows) {
      const bid = chapterToBook.get(s.chapterId);
      if (bid) booksWithActivity.add(bid);
    }

    return {
      classId: cls.id,
      classNumber: ctx.user.class!,
      subjects: subjectsOut,
      stats: {
        subjectCount: subjectsOut.length,
        booksReading: booksWithActivity.size,
        testsTaken: testsTakenRow?.n ?? 0,
        avgScorePercent:
          avgScoreRow?.avg != null ? Math.round(Number(avgScoreRow.avg)) : null,
      },
    };
  }),
});
