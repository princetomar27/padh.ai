import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { books } from "@/db/schema";
import { BOOK_PDF_PIPELINE_VERSION } from "@/lib/book-pdf/constants";
import { prepareMultiChapterIngest } from "@/lib/book-pdf/prepare-multi-chapter-ingest";
import { ingest } from "@/inngest/client";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import {
  bookIdSchema,
  createBookMultiChapterSchema,
  createBookSchema,
  enqueueBookProcessSchema,
} from "../schemas";

export const booksRouter = createTRPCRouter({
  list: adminProcedure.query(async () => {
    return db.select().from(books).orderBy(desc(books.createdAt));
  }),

  getById: adminProcedure.input(bookIdSchema).query(async ({ input }) => {
    const [row] = await db
      .select()
      .from(books)
      .where(eq(books.id, input.bookId))
      .limit(1);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
    }
    return row;
  }),

  create: adminProcedure.input(createBookSchema).mutation(async ({ input }) => {
    const [book] = await db
      .insert(books)
      .values({
        title: input.title,
        description: input.description,
        author: input.author,
        publisher: input.publisher,
        isbn: input.isbn,
        subjectId: input.subjectId,
        classId: input.classId,
        supabaseStorageUrl: input.supabaseStorageUrl,
        pdfSize: input.pdfSize,
        processingStatus: "PENDING",
        totalPages: 0,
      })
      .returning();

    if (!book) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create book",
      });
    }

    await ingest.send({
      name: "padhai/book.process",
      data: { bookId: book.id },
    });

    return book;
  }),

  /**
   * One PDF per chapter — Inngest stitches global page numbers and assigns
   * `chapter_number` explicitly (fixes whole-book PDFs with missing/bad outlines).
   */
  createWithChapterPdfs: adminProcedure
    .input(createBookMultiChapterSchema)
    .mutation(async ({ input }) => {
      const sorted = [...input.chapterPdfs].sort(
        (a, b) => a.chapterNumber - b.chapterNumber,
      );
      const totalPdfSize = sorted.reduce((n, c) => n + (c.pdfSize ?? 0), 0);
      const chapterIngestSources = sorted.map((c) => ({
        chapterNumber: c.chapterNumber,
        supabaseStorageUrl: c.supabaseStorageUrl,
        title: c.title,
      }));

      const [book] = await db
        .insert(books)
        .values({
          title: input.title,
          description: input.description,
          author: input.author,
          publisher: input.publisher,
          isbn: input.isbn,
          subjectId: input.subjectId,
          classId: input.classId,
          supabaseStorageUrl: sorted[0]!.supabaseStorageUrl,
          pdfSize: totalPdfSize > 0 ? totalPdfSize : undefined,
          expectedChapterCount: input.noOfChapters,
          chapterIngestSources,
          processingStatus: "PENDING",
          totalPages: 0,
        })
        .returning();

      if (!book) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create book",
        });
      }

      const dispatched = await prepareMultiChapterIngest({
        bookId: book.id,
        bookTitle: book.title,
        subjectId: book.subjectId,
        classId: book.classId,
        sources: chapterIngestSources,
      });

      await ingest.send(
        dispatched.map((d) => ({
          name: "padhai/book.chapter.process" as const,
          data: {
            bookId: d.bookId,
            chapterId: d.chapterId,
            chapterNumber: d.chapterNumber,
            supabaseStorageUrl: d.supabaseStorageUrl,
            title: d.title,
            startPage: d.startPage,
            endPage: d.endPage,
          },
          id: `book-${book.id}-ch-${d.chapterNumber}-pv${BOOK_PDF_PIPELINE_VERSION}`,
        })),
      );

      return book;
    }),

  enqueueProcessing: adminProcedure
    .input(enqueueBookProcessSchema)
    .mutation(async ({ input }) => {
      const [book] = await db
        .select({
          id: books.id,
          chapterIngestSources: books.chapterIngestSources,
          title: books.title,
          subjectId: books.subjectId,
          classId: books.classId,
        })
        .from(books)
        .where(eq(books.id, input.bookId))
        .limit(1);
      if (!book) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      }

      const chapterPdfSources =
        Array.isArray(book.chapterIngestSources) &&
        book.chapterIngestSources.length > 0
          ? (book.chapterIngestSources as {
              chapterNumber: number;
              supabaseStorageUrl: string;
              title?: string;
            }[])
          : undefined;

      if (chapterPdfSources?.length) {
        const dispatched = await prepareMultiChapterIngest({
          bookId: input.bookId,
          bookTitle: book.title,
          subjectId: book.subjectId,
          classId: book.classId,
          sources: chapterPdfSources,
        });

        await ingest.send(
          dispatched.map((d) => ({
            name: "padhai/book.chapter.process" as const,
            data: {
              bookId: d.bookId,
              chapterId: d.chapterId,
              chapterNumber: d.chapterNumber,
              supabaseStorageUrl: d.supabaseStorageUrl,
              title: d.title,
              startPage: d.startPage,
              endPage: d.endPage,
            },
            id: `book-${input.bookId}-ch-${d.chapterNumber}-${randomUUID()}`,
          })),
        );
      } else {
        await ingest.send({
          name: "padhai/book.process",
          data: {
            bookId: input.bookId,
            forceReprocess: input.forceReprocess,
          },
        });
      }

      return { ok: true as const, bookId: input.bookId };
    }),
});
