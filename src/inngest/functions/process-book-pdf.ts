import { db } from "@/db";
import {
  bookPages,
  bookProcessingJobs,
  books,
  chapters,
  pdfChunks,
} from "@/db/schema";
import { buildChunksFromPageMetadata } from "@/lib/book-pdf/build-chunks";
import {
  BOOK_PDF_PAGES_PER_STEP,
  BOOK_PDF_PIPELINE_VERSION,
} from "@/lib/book-pdf/constants";
import {
  chapterMetaForPage,
  extractChapterRanges,
  type ChapterRange,
} from "@/lib/book-pdf/chapter-outline";
import { loadPdfDocumentFromBuffer } from "@/lib/book-pdf/pdf-loader";
import {
  processPdfPage,
  type PageProcessMetadata,
} from "@/lib/book-pdf/process-page";
import { fetchBookPdfBuffer } from "@/lib/supabase/fetch-book-pdf";
import { ingest } from "@/inngest/client";
import { put } from "@vercel/blob";
import { eq, inArray, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

export type ProcessBookPdfEvent = {
  name: "padhai/book.process";
  data: {
    bookId: string;
    forceReprocess?: boolean;
  };
};

async function markBookFailed(
  bookId: string,
  jobId: string | null,
  message: string,
) {
  await db
    .update(books)
    .set({
      processingStatus: "FAILED",
      updatedAt: new Date(),
    })
    .where(eq(books.id, bookId));
  if (jobId) {
    await db
      .update(bookProcessingJobs)
      .set({
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bookProcessingJobs.id, jobId));
  }
}

export const processBookPdf = ingest.createFunction(
  {
    id: "process-book-pdf",
    name: "Process NCERT book PDF",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.bookId" },
    singleton: { key: "event.data.bookId", mode: "cancel" },
  },
  { event: "padhai/book.process" },
  async ({ event, step }) => {
    const bookId = event.data.bookId;

    const init = await step.run("init-job", async () => {
      const [book] = await db
        .select()
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);
      if (!book) {
        throw new NonRetriableError(`Book not found: ${bookId}`);
      }
      if (!book.supabaseStorageUrl) {
        throw new NonRetriableError(
          `Book ${bookId} has not been uploaded to storage yet.`,
        );
      }
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        throw new NonRetriableError("Storage is not configured");
      }

      const [job] = await db
        .insert(bookProcessingJobs)
        .values({
          bookId,
          inngestRunId: null,
          status: "PROCESSING",
          startedAt: new Date(),
          metadata: { pipelineVersion: BOOK_PDF_PIPELINE_VERSION },
        })
        .returning({ id: bookProcessingJobs.id });

      await db
        .update(books)
        .set({
          processingStatus: "PROCESSING",
          updatedAt: new Date(),
        })
        .where(eq(books.id, bookId));

      return {
        jobId: job?.id ?? null,
        storagePathOrUrl: book.supabaseStorageUrl,
        bookTitle: book.title,
        subjectId: book.subjectId,
        classId: book.classId,
        pdfSize: book.pdfSize,
      };
    });

    const { jobId, storagePathOrUrl, bookTitle, subjectId, classId } = init;

    try {
      const meta = await step.run("pdf-metadata-and-chapters", async () => {
        await db.delete(chapters).where(eq(chapters.bookId, bookId));
        await db.delete(bookPages).where(eq(bookPages.bookId, bookId));

        const buffer = await fetchBookPdfBuffer(storagePathOrUrl);
        const pdf = await loadPdfDocumentFromBuffer(buffer);
        try {
          const { numPages, ranges } = await extractChapterRanges(
            pdf,
            bookTitle,
          );
          await db
            .update(books)
            .set({
              totalPages: numPages,
              updatedAt: new Date(),
            })
            .where(eq(books.id, bookId));

          await db.insert(chapters).values(
            ranges.map((r: ChapterRange) => ({
              bookId,
              subjectId,
              classId,
              title: r.title,
              chapterNumber: r.chapterNumber,
              startPage: r.startPage,
              endPage: r.endPage,
              processingStatus: "PROCESSING" as const,
            })),
          );

          const inserted = await db
            .select({
              id: chapters.id,
              chapterNumber: chapters.chapterNumber,
            })
            .from(chapters)
            .where(eq(chapters.bookId, bookId));

          const chapterIdByNumber = new Map<number, string>();
          for (const row of inserted) {
            chapterIdByNumber.set(row.chapterNumber, row.id);
          }

          return {
            numPages,
            ranges,
            chapterIdByNumber: Object.fromEntries(chapterIdByNumber),
          };
        } finally {
          await pdf.destroy();
        }
      });

      const chapterIdByNumber = new Map<number, string>(
        Object.entries(meta.chapterIdByNumber).map(([k, v]) => [Number(k), v]),
      );
      const { numPages, ranges } = meta;

      const batches: { from: number; to: number }[] = [];
      for (let start = 1; start <= numPages; start += BOOK_PDF_PAGES_PER_STEP) {
        const to = Math.min(start + BOOK_PDF_PAGES_PER_STEP - 1, numPages);
        batches.push({ from: start, to });
      }

      for (const batch of batches) {
        await step.run(`pages-${batch.from}-${batch.to}`, async () => {
          const buffer = await fetchBookPdfBuffer(storagePathOrUrl);
          const pdf = await loadPdfDocumentFromBuffer(buffer);
          try {
            for (
              let pageNumber = batch.from;
              pageNumber <= batch.to;
              pageNumber++
            ) {
              const ch = chapterMetaForPage(pageNumber, ranges);
              const chapterId = chapterIdByNumber.get(ch.chapterNumber);
              if (!chapterId) {
                throw new Error(
                  `No chapter id for chapter number ${ch.chapterNumber}`,
                );
              }

              const processed = await processPdfPage(pdf, pageNumber);
              const blobPath = `books/${bookId}/pages/${pageNumber}.webp`;
              const blob = await put(blobPath, processed.imageWebp, {
                access: "public",
                token: process.env.BLOB_READ_WRITE_TOKEN!,
                contentType: "image/webp",
              });

              await db
                .insert(bookPages)
                .values({
                  bookId,
                  pageNumber,
                  imageUrl: blob.url,
                  textContent: processed.textContent,
                  chapterTitle: ch.chapterTitle,
                  chapterNumber: ch.chapterNumber,
                  isChapterStart: ch.isChapterStart,
                  hasEquations: processed.hasEquations,
                  hasImages: processed.hasImages,
                  metadata: processed.metadata,
                })
                .onConflictDoUpdate({
                  target: [bookPages.bookId, bookPages.pageNumber],
                  set: {
                    imageUrl: sql`excluded.image_url`,
                    textContent: sql`excluded.text_content`,
                    chapterTitle: sql`excluded.chapter_title`,
                    chapterNumber: sql`excluded.chapter_number`,
                    isChapterStart: sql`excluded.is_chapter_start`,
                    hasEquations: sql`excluded.has_equations`,
                    hasImages: sql`excluded.has_images`,
                    metadata: sql`excluded.metadata`,
                    updatedAt: new Date(),
                  },
                });
            }
          } finally {
            await pdf.destroy();
          }
        });

        await db
          .update(bookProcessingJobs)
          .set({
            pagesProcessed: batch.to,
            updatedAt: new Date(),
          })
          .where(eq(bookProcessingJobs.id, jobId));
      }

      const chunkStats = await step.run("build-pdf-chunks", async () => {
        const chapterRows = await db
          .select({
            id: chapters.id,
            chapterNumber: chapters.chapterNumber,
            startPage: chapters.startPage,
            endPage: chapters.endPage,
          })
          .from(chapters)
          .where(eq(chapters.bookId, bookId))
          .orderBy(chapters.chapterNumber);

        const pages = await db
          .select()
          .from(bookPages)
          .where(eq(bookPages.bookId, bookId))
          .orderBy(bookPages.pageNumber);

        const pagesByChapter = new Map<string, typeof pages>();
        for (const ch of chapterRows) {
          const list = pages.filter(
            (p) => p.pageNumber >= ch.startPage && p.pageNumber <= ch.endPage,
          );
          pagesByChapter.set(ch.id, list);
        }

        const chapterIds = chapterRows.map((c) => c.id);
        if (chapterIds.length) {
          await db
            .delete(pdfChunks)
            .where(inArray(pdfChunks.chapterId, chapterIds));
        }

        let chunksTotal = 0;

        for (const ch of chapterRows) {
          const list = pagesByChapter.get(ch.id) ?? [];
          let order = 0;
          for (const page of list) {
            const pageMeta = page.metadata as PageProcessMetadata | null;
            if (
              !pageMeta ||
              typeof pageMeta.pageWidth !== "number" ||
              typeof pageMeta.pageHeight !== "number" ||
              !Array.isArray(pageMeta.textItems)
            ) {
              continue;
            }

            const { chunks, nextOrder } = buildChunksFromPageMetadata(
              pageMeta,
              order,
            );
            order = nextOrder;

            if (chunks.length === 0) continue;

            await db.insert(pdfChunks).values(
              chunks.map((c) => ({
                bookPageId: page.id,
                chapterId: ch.id,
                chunkIndex: c.chunkIndex,
                orderInChapter: c.orderInChapter,
                text: c.text,
                boundingBoxes: c.boundingBoxes,
                isEquation: c.isEquation,
                equationDescription: null,
                isImage: c.isImage,
                imageDescription: null,
                speakText: c.speakText,
              })),
            );
            chunksTotal += chunks.length;
          }

          await db
            .update(chapters)
            .set({
              totalChunks: order,
              processingStatus: "COMPLETED",
              updatedAt: new Date(),
            })
            .where(eq(chapters.id, ch.id));
        }

        return { chunksTotal };
      });

      await step.run("finalize", async () => {
        await db
          .update(bookProcessingJobs)
          .set({
            status: "COMPLETED",
            pagesProcessed: numPages,
            chunksExtracted: chunkStats.chunksTotal,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(bookProcessingJobs.id, jobId));

        await db
          .update(books)
          .set({
            processingStatus: "COMPLETED",
            updatedAt: new Date(),
          })
          .where(eq(books.id, bookId));
      });

      return {
        ok: true as const,
        bookId,
        pages: numPages,
        chunks: chunkStats.chunksTotal,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await markBookFailed(bookId, jobId, message);
      throw err;
    }
  },
);
