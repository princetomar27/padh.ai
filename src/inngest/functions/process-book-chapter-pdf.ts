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
  BOOK_PDF_CHUNK_BUILD_DB_PAGE_BATCH,
  BOOK_PDF_PAGES_PER_STEP,
  BOOK_PDF_PIPELINE_VERSION,
  BOOK_PDF_VISION_LIST_DB_BATCH,
  BOOK_VISION_CHUNKS_PER_STEP,
} from "@/lib/book-pdf/constants";
import {
  bookVisionProcessingEnabled,
  describeDiagramChunkWithVision,
  describeEquationChunkWithVision,
} from "@/lib/book-pdf/describe-chunk-vision";
import { loadPdfDocumentFromBuffer } from "@/lib/book-pdf/pdf-loader";
import { sanitizePostgresUtf8Text } from "@/lib/book-pdf/sanitize-postgres-text";
import {
  processPdfPage,
  type PageProcessMetadata,
} from "@/lib/book-pdf/process-page";
import { fetchBookPdfBuffer } from "@/lib/supabase/fetch-book-pdf";
import { ingest } from "@/inngest/client";
import { put } from "@vercel/blob";
import { and, asc, count, eq, gte, lte, ne, or, sql } from "drizzle-orm";
import { NonRetriableError } from "inngest";

export type ProcessBookChapterPdfEvent = {
  name: "padhai/book.chapter.process";
  data: {
    bookId: string;
    chapterId: string;
    chapterNumber: number;
    supabaseStorageUrl: string;
    title?: string;
    startPage: number;
    endPage: number;
    forceReprocess?: boolean;
  };
};

async function markBookFailedFromChapter(bookId: string, chapterId: string) {
  await db
    .update(books)
    .set({
      processingStatus: "FAILED",
      updatedAt: new Date(),
    })
    .where(eq(books.id, bookId));
  await db
    .update(chapters)
    .set({
      processingStatus: "FAILED",
      updatedAt: new Date(),
    })
    .where(eq(chapters.id, chapterId));
}

/**
 * When every chapter for the book is COMPLETED, mark the book COMPLETED once
 * and enqueue important-questions generation (idempotent via conditional update).
 */
async function tryFinalizeBookAfterAllChapters(bookId: string) {
  const [{ incomplete }] = await db
    .select({
      incomplete: count(),
    })
    .from(chapters)
    .where(
      and(
        eq(chapters.bookId, bookId),
        ne(chapters.processingStatus, "COMPLETED"),
      ),
    );

  if (Number(incomplete) > 0) {
    return;
  }

  const [updated] = await db
    .update(books)
    .set({
      processingStatus: "COMPLETED",
      updatedAt: new Date(),
    })
    .where(and(eq(books.id, bookId), eq(books.processingStatus, "PROCESSING")))
    .returning({ id: books.id });

  if (!updated) {
    return;
  }

  const pendingQuestions = await db
    .select({ id: chapters.id })
    .from(chapters)
    .where(
      and(
        eq(chapters.bookId, bookId),
        eq(chapters.processingStatus, "COMPLETED"),
        eq(chapters.questionsGenerated, false),
      ),
    );

  if (pendingQuestions.length > 0) {
    await ingest.send(
      pendingQuestions.map((c) => ({
        name: "padhai/chapter.generateImportantQuestions" as const,
        data: { chapterId: c.id },
      })),
    );
  }
}

export const processBookChapterPdf = ingest.createFunction(
  {
    id: "process-book-chapter-pdf",
    name: "Process NCERT book chapter PDF",
    retries: 3,
    concurrency: { limit: 4, key: "event.data.bookId" },
    timeouts: { finish: "2h" },
  },
  { event: "padhai/book.chapter.process" },
  async ({ event, step, runId }) => {
    const {
      bookId,
      chapterId,
      chapterNumber,
      supabaseStorageUrl,
      title,
      startPage,
      endPage,
    } = event.data;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new NonRetriableError("Storage is not configured");
    }

    const init = await step.run("init-chapter-job", async () => {
      const [book] = await db
        .select({ id: books.id })
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);
      if (!book) {
        throw new NonRetriableError(`Book not found: ${bookId}`);
      }
      const [ch] = await db
        .select({ id: chapters.id })
        .from(chapters)
        .where(eq(chapters.id, chapterId))
        .limit(1);
      if (!ch) {
        throw new NonRetriableError(`Chapter not found: ${chapterId}`);
      }

      const [job] = await db
        .insert(bookProcessingJobs)
        .values({
          bookId,
          inngestRunId: runId,
          status: "PROCESSING",
          startedAt: new Date(),
          metadata: {
            pipelineVersion: BOOK_PDF_PIPELINE_VERSION,
            chapterNumber,
            chapterIngest: true,
          },
        })
        .returning({ id: bookProcessingJobs.id });

      await db
        .update(books)
        .set({
          processingStatus: "PROCESSING",
          updatedAt: new Date(),
        })
        .where(eq(books.id, bookId));

      return { jobId: job?.id ?? null };
    });

    const { jobId } = init;
    const numPagesInChapter = endPage - startPage + 1;
    const chapterTitle = title?.trim() || `Chapter ${chapterNumber}`;

    try {
      const batches: { from: number; to: number }[] = [];
      for (let s = startPage; s <= endPage; s += BOOK_PDF_PAGES_PER_STEP) {
        const to = Math.min(s + BOOK_PDF_PAGES_PER_STEP - 1, endPage);
        batches.push({ from: s, to });
      }

      for (const batch of batches) {
        await step.run(`pages-${batch.from}-${batch.to}`, async () => {
          const existingInBatch = await db
            .select({ pageNumber: bookPages.pageNumber })
            .from(bookPages)
            .where(
              and(
                eq(bookPages.bookId, bookId),
                gte(bookPages.pageNumber, batch.from),
                lte(bookPages.pageNumber, batch.to),
              ),
            );
          const skipPages = new Set(existingInBatch.map((r) => r.pageNumber));

          const buffer = await fetchBookPdfBuffer(supabaseStorageUrl);
          const pdf = await loadPdfDocumentFromBuffer(buffer);
          try {
            for (
              let globalPage = batch.from;
              globalPage <= batch.to;
              globalPage++
            ) {
              if (skipPages.has(globalPage)) {
                continue;
              }
              const localPage = globalPage - startPage + 1;
              if (localPage < 1 || localPage > numPagesInChapter) {
                throw new Error(
                  `Page ${globalPage} out of chapter range ${startPage}-${endPage}`,
                );
              }

              try {
                const processed = await processPdfPage(pdf, localPage);
                const blobPath = `books/${bookId}/pages/${globalPage}.webp`;
                const blob = await put(blobPath, processed.imageWebp, {
                  access: "public",
                  token: process.env.BLOB_READ_WRITE_TOKEN!,
                  contentType: "image/webp",
                  allowOverwrite: true,
                });

                const safeTitle = sanitizePostgresUtf8Text(chapterTitle);

                await db
                  .insert(bookPages)
                  .values({
                    bookId,
                    pageNumber: globalPage,
                    imageUrl: blob.url,
                    textContent: sanitizePostgresUtf8Text(
                      processed.textContent,
                    ),
                    chapterTitle: safeTitle,
                    chapterNumber,
                    isChapterStart: localPage === 1,
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
              } catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                throw new Error(
                  `Book ${bookId} page ${globalPage} failed: ${detail}`,
                );
              }
            }
          } finally {
            await pdf.destroy();
          }

          return {
            from: batch.from,
            to: batch.to,
            pageCount: batch.to - batch.from + 1,
          };
        });

        if (jobId) {
          await db
            .update(bookProcessingJobs)
            .set({
              pagesProcessed: batch.to,
              updatedAt: new Date(),
            })
            .where(eq(bookProcessingJobs.id, jobId));
        }
      }

      const chunkStats = await step.run("build-pdf-chunks", async () => {
        await db.delete(pdfChunks).where(eq(pdfChunks.chapterId, chapterId));

        let order = 0;
        let chunksTotal = 0;
        const pageBatch = BOOK_PDF_CHUNK_BUILD_DB_PAGE_BATCH;

        for (
          let winStart = startPage;
          winStart <= endPage;
          winStart += pageBatch
        ) {
          const winEnd = Math.min(winStart + pageBatch - 1, endPage);
          const batchPages = await db
            .select({
              id: bookPages.id,
              pageNumber: bookPages.pageNumber,
              metadata: bookPages.metadata,
            })
            .from(bookPages)
            .where(
              and(
                eq(bookPages.bookId, bookId),
                gte(bookPages.pageNumber, winStart),
                lte(bookPages.pageNumber, winEnd),
              ),
            )
            .orderBy(bookPages.pageNumber);

          for (const page of batchPages) {
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
                chapterId,
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
        }

        await db
          .update(chapters)
          .set({
            totalChunks: order,
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, chapterId));

        return { chunksTotal };
      });

      const visionTargets = await step.run("vision-list-targets", async () => {
        const list: {
          chunkId: string;
          isEquation: boolean;
          isImage: boolean;
          text: string;
          imageUrl: string;
        }[] = [];
        const batchSize = BOOK_PDF_VISION_LIST_DB_BATCH;
        for (let offset = 0; ; offset += batchSize) {
          const rows = await db
            .select({
              chunkId: pdfChunks.id,
              isEquation: pdfChunks.isEquation,
              isImage: pdfChunks.isImage,
              text: pdfChunks.text,
              imageUrl: bookPages.imageUrl,
            })
            .from(pdfChunks)
            .innerJoin(bookPages, eq(pdfChunks.bookPageId, bookPages.id))
            .where(
              and(
                eq(pdfChunks.chapterId, chapterId),
                or(eq(pdfChunks.isEquation, true), eq(pdfChunks.isImage, true)),
              ),
            )
            .orderBy(asc(pdfChunks.id))
            .limit(batchSize)
            .offset(offset);
          if (rows.length === 0) break;
          for (const r of rows) {
            list.push({
              chunkId: r.chunkId,
              isEquation: r.isEquation,
              isImage: r.isImage,
              text: r.text,
              imageUrl: r.imageUrl,
            });
          }
          if (rows.length < batchSize) break;
        }
        return list;
      });

      const canVision = bookVisionProcessingEnabled();
      if (canVision && visionTargets.length > 0) {
        for (
          let i = 0;
          i < visionTargets.length;
          i += BOOK_VISION_CHUNKS_PER_STEP
        ) {
          const slice = visionTargets.slice(i, i + BOOK_VISION_CHUNKS_PER_STEP);
          await step.run(`vision-batch-${i}`, async () => {
            const delay = (ms: number) =>
              new Promise((resolve) => setTimeout(resolve, ms));

            for (const row of slice) {
              if (row.isEquation) {
                const desc = await describeEquationChunkWithVision({
                  pageImageUrl: row.imageUrl,
                  extractedText: row.text,
                });
                await db
                  .update(pdfChunks)
                  .set({
                    equationDescription: desc,
                    speakText: desc,
                    updatedAt: new Date(),
                  })
                  .where(eq(pdfChunks.id, row.chunkId));
              } else if (row.isImage) {
                const desc = await describeDiagramChunkWithVision({
                  pageImageUrl: row.imageUrl,
                  contextHint: row.text,
                });
                await db
                  .update(pdfChunks)
                  .set({
                    imageDescription: desc,
                    speakText: desc,
                    updatedAt: new Date(),
                  })
                  .where(eq(pdfChunks.id, row.chunkId));
              }
              await delay(120);
            }
          });
        }
      }

      await step.run("finalize-chapter-job", async () => {
        if (jobId) {
          await db
            .update(bookProcessingJobs)
            .set({
              status: "COMPLETED",
              pagesProcessed: endPage,
              chunksExtracted: chunkStats.chunksTotal,
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(bookProcessingJobs.id, jobId));
        }

        await db
          .update(chapters)
          .set({
            processingStatus: "COMPLETED",
            updatedAt: new Date(),
          })
          .where(eq(chapters.id, chapterId));

        await tryFinalizeBookAfterAllChapters(bookId);
      });

      return {
        ok: true as const,
        bookId,
        chapterNumber,
        pages: numPagesInChapter,
        chunks: chunkStats.chunksTotal,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
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
      await markBookFailedFromChapter(bookId, chapterId);
      throw err;
    }
  },
);
