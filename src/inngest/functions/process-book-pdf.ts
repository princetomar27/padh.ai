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
import {
  chapterMetaForPage,
  extractChapterRanges,
  type ChapterRange,
} from "@/lib/book-pdf/chapter-outline";
import { loadPdfDocumentFromBuffer } from "@/lib/book-pdf/pdf-loader";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { sanitizePostgresUtf8Text } from "@/lib/book-pdf/sanitize-postgres-text";
import {
  processPdfPage,
  type PageProcessMetadata,
} from "@/lib/book-pdf/process-page";
import {
  prepareMultiChapterIngest,
  type ChapterPdfSource,
} from "@/lib/book-pdf/prepare-multi-chapter-ingest";
import { fetchBookPdfBuffer } from "@/lib/supabase/fetch-book-pdf";
import { ingest } from "@/inngest/client";
import { put } from "@vercel/blob";
import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  lte,
  max,
  or,
  sql,
} from "drizzle-orm";
import { NonRetriableError } from "inngest";

export type { ChapterPdfSource } from "@/lib/book-pdf/prepare-multi-chapter-ingest";

export type ProcessBookPdfEvent = {
  name: "padhai/book.process";
  data: {
    bookId: string;
    forceReprocess?: boolean;
    /** When set (or stored on `books.chapter_ingest_sources`), pages are built from these PDFs in order. */
    chapterPdfSources?: ChapterPdfSource[];
  };
};

type MultiChapterPagePlanEntry = {
  globalPage: number;
  localPage: number;
  storageUrl: string;
  chapterNumber: number;
  chapterTitle: string;
};

/** Normalized return from the `pdf-metadata-and-chapters` Inngest step. */
type PdfMetaStepResult = {
  numPages: number;
  ranges: ChapterRange[];
  chapterIdByNumber: Record<string, string>;
  multiChapterPages?: MultiChapterPagePlanEntry[];
};

function resolveChapterPdfSources(
  fromEvent: ChapterPdfSource[] | undefined,
  fromDb: unknown,
): ChapterPdfSource[] {
  const raw =
    fromEvent && fromEvent.length > 0
      ? fromEvent
      : Array.isArray(fromDb)
        ? (fromDb as ChapterPdfSource[])
        : [];
  if (raw.length === 0) return [];
  return [...raw].sort((a, b) => a.chapterNumber - b.chapterNumber);
}

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
    /** Long books (400+ pages) + many steps need a generous wall-clock budget. */
    timeouts: { finish: "4h" },
  },
  { event: "padhai/book.process" },
  async ({ event, step, runId }) => {
    const bookId = event.data.bookId;
    const forceReprocess = event.data.forceReprocess ?? false;

    const init = await step.run("init-job", async () => {
      const [book] = await db
        .select()
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);
      if (!book) {
        throw new NonRetriableError(`Book not found: ${bookId}`);
      }
      const hasChapterSources =
        Array.isArray(book.chapterIngestSources) &&
        book.chapterIngestSources.length > 0;
      if (!book.supabaseStorageUrl && !hasChapterSources) {
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
          inngestRunId: runId,
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
        storagePathOrUrl:
          book.supabaseStorageUrl ??
          (hasChapterSources
            ? book.chapterIngestSources![0]!.supabaseStorageUrl
            : ""),
        bookTitle: book.title,
        subjectId: book.subjectId,
        classId: book.classId,
        pdfSize: book.pdfSize,
      };
    });

    const { jobId, storagePathOrUrl, bookTitle, subjectId, classId } = init;

    const fanoutPrep = await step.run("multi-book-fanout-prepare", async () => {
      const [bookSrcRow] = await db
        .select({ chapterIngestSources: books.chapterIngestSources })
        .from(books)
        .where(eq(books.id, bookId))
        .limit(1);

      const sources = resolveChapterPdfSources(
        event.data.chapterPdfSources,
        bookSrcRow?.chapterIngestSources,
      );
      if (sources.length <= 1) {
        return { kind: "defer" as const };
      }
      const dispatched = await prepareMultiChapterIngest({
        bookId,
        bookTitle,
        subjectId,
        classId,
        sources,
      });
      return { kind: "fanout" as const, dispatched };
    });

    if (fanoutPrep.kind === "fanout") {
      const chapterCount = fanoutPrep.dispatched.length;
      try {
        await step.sendEvent(
          "dispatch-chapter-workers",
          fanoutPrep.dispatched.map((d) => ({
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
            id: `book-${bookId}-ch-${d.chapterNumber}-pv${BOOK_PDF_PIPELINE_VERSION}`,
          })),
        );
        await step.run("finalize-coordinator-job", async () => {
          if (jobId) {
            await db
              .update(bookProcessingJobs)
              .set({
                status: "COMPLETED",
                pagesProcessed: 0,
                chunksExtracted: 0,
                completedAt: new Date(),
                updatedAt: new Date(),
                metadata: {
                  pipelineVersion: BOOK_PDF_PIPELINE_VERSION,
                  fanoutCoordinator: true,
                  chapterIngestRuns: chapterCount,
                },
              })
              .where(eq(bookProcessingJobs.id, jobId));
          }
        });
        return {
          ok: true as const,
          bookId,
          fanout: true as const,
          chapters: chapterCount,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await markBookFailed(bookId, jobId, message);
        throw err;
      }
    }

    try {
      const meta = (await step.run("pdf-metadata-and-chapters", async () => {
        const [bookSrcRow] = await db
          .select({ chapterIngestSources: books.chapterIngestSources })
          .from(books)
          .where(eq(books.id, bookId))
          .limit(1);

        const chapterPdfSources = resolveChapterPdfSources(
          event.data.chapterPdfSources,
          bookSrcRow?.chapterIngestSources,
        );
        const multi = chapterPdfSources.length === 1;

        const [pageCountRow] = await db
          .select({ c: count() })
          .from(bookPages)
          .where(eq(bookPages.bookId, bookId));
        const existingPageCount = Number(pageCountRow?.c ?? 0);
        const [anyChapter] = await db
          .select({ id: chapters.id })
          .from(chapters)
          .where(eq(chapters.bookId, bookId))
          .limit(1);

        const canResume =
          !forceReprocess &&
          !multi &&
          existingPageCount > 0 &&
          Boolean(anyChapter?.id);

        if (canResume) {
          const [bookRow] = await db
            .select({ totalPages: books.totalPages })
            .from(books)
            .where(eq(books.id, bookId))
            .limit(1);
          const [maxPageRow] = await db
            .select({ m: max(bookPages.pageNumber) })
            .from(bookPages)
            .where(eq(bookPages.bookId, bookId));

          const buffer = await fetchBookPdfBuffer(storagePathOrUrl);
          const pdfProbe = await loadPdfDocumentFromBuffer(buffer);
          let pdfNumPages: number;
          try {
            pdfNumPages = pdfProbe.numPages;
          } finally {
            await pdfProbe.destroy();
          }

          const maxStored = Number(maxPageRow?.m ?? 0);
          let numPages = Math.max(
            bookRow?.totalPages ?? 0,
            pdfNumPages,
            maxStored,
          );
          if (numPages < 1) {
            throw new Error("Resume failed: could not determine page count");
          }

          await db
            .update(books)
            .set({
              totalPages: numPages,
              updatedAt: new Date(),
            })
            .where(eq(books.id, bookId));

          const chapterRows = await db
            .select({
              id: chapters.id,
              chapterNumber: chapters.chapterNumber,
              title: chapters.title,
              startPage: chapters.startPage,
              endPage: chapters.endPage,
            })
            .from(chapters)
            .where(eq(chapters.bookId, bookId))
            .orderBy(asc(chapters.chapterNumber));

          const ranges: ChapterRange[] = chapterRows.map((r) => ({
            chapterNumber: r.chapterNumber,
            title: r.title,
            startPage: r.startPage,
            endPage: r.endPage,
          }));

          if (ranges.length > 0) {
            const lastIdx = ranges.length - 1;
            if (ranges[lastIdx].endPage < numPages) {
              ranges[lastIdx] = {
                ...ranges[lastIdx],
                endPage: numPages,
              };
              await db
                .update(chapters)
                .set({
                  endPage: numPages,
                  updatedAt: new Date(),
                })
                .where(eq(chapters.id, chapterRows[lastIdx].id));
            }
          }

          const chapterIdByNumber: Record<string, string> = {};
          for (const r of chapterRows) {
            chapterIdByNumber[String(r.chapterNumber)] = r.id;
          }

          return {
            numPages,
            ranges,
            chapterIdByNumber,
            multiChapterPages: undefined,
          } satisfies PdfMetaStepResult;
        }

        await db.delete(chapters).where(eq(chapters.bookId, bookId));
        await db.delete(bookPages).where(eq(bookPages.bookId, bookId));

        if (multi) {
          let globalPage = 1;
          const pagePlan: MultiChapterPagePlanEntry[] = [];
          const ranges: ChapterRange[] = [];

          for (const src of chapterPdfSources) {
            const buffer = await fetchBookPdfBuffer(src.supabaseStorageUrl);
            const pdf = await loadPdfDocumentFromBuffer(buffer);
            let np: number;
            try {
              np = pdf.numPages;
            } finally {
              await pdf.destroy();
            }
            if (np < 1) {
              throw new Error(`Chapter ${src.chapterNumber} PDF has no pages.`);
            }
            const chTitle = sanitizePostgresUtf8Text(
              src.title?.trim() ||
                `${bookTitle} · Chapter ${src.chapterNumber}`,
            );
            ranges.push({
              chapterNumber: src.chapterNumber,
              title: chTitle,
              startPage: globalPage,
              endPage: globalPage + np - 1,
            });
            for (let lp = 1; lp <= np; lp++) {
              pagePlan.push({
                globalPage,
                localPage: lp,
                storageUrl: src.supabaseStorageUrl,
                chapterNumber: src.chapterNumber,
                chapterTitle: chTitle,
              });
              globalPage += 1;
            }
          }

          const numPages = globalPage - 1;
          if (numPages < 1) {
            throw new Error("Per-chapter PDFs produced zero total pages");
          }

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
            multiChapterPages: pagePlan,
          } satisfies PdfMetaStepResult;
        }

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
              title: sanitizePostgresUtf8Text(r.title),
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
            multiChapterPages: undefined,
          } satisfies PdfMetaStepResult;
        } finally {
          await pdf.destroy();
        }
      })) as PdfMetaStepResult;
      const { numPages, ranges } = meta;
      const chapterIdByNumber = new Map<number, string>(
        Object.entries(meta.chapterIdByNumber).map(([k, v]) => [Number(k), v]),
      );

      const batches: { from: number; to: number }[] = [];
      for (let start = 1; start <= numPages; start += BOOK_PDF_PAGES_PER_STEP) {
        const to = Math.min(start + BOOK_PDF_PAGES_PER_STEP - 1, numPages);
        batches.push({ from: start, to });
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

          const multiPlan = meta.multiChapterPages;

          if (multiPlan && multiPlan.length > 0) {
            const pdfCache = new Map<string, PDFDocumentProxy>();
            try {
              const inBatch = multiPlan
                .filter(
                  (e: MultiChapterPagePlanEntry) =>
                    e.globalPage >= batch.from && e.globalPage <= batch.to,
                )
                .sort(
                  (
                    a: MultiChapterPagePlanEntry,
                    b: MultiChapterPagePlanEntry,
                  ) => a.globalPage - b.globalPage,
                );

              for (const entry of inBatch) {
                const pageNumber = entry.globalPage;
                if (skipPages.has(pageNumber)) {
                  continue;
                }

                const chapterId = chapterIdByNumber.get(entry.chapterNumber);
                if (!chapterId) {
                  throw new Error(
                    `No chapter id for chapter number ${entry.chapterNumber}`,
                  );
                }

                let pdf = pdfCache.get(entry.storageUrl);
                if (!pdf) {
                  const buf = await fetchBookPdfBuffer(entry.storageUrl);
                  pdf = await loadPdfDocumentFromBuffer(buf);
                  pdfCache.set(entry.storageUrl, pdf);
                }

                try {
                  const processed = await processPdfPage(pdf, entry.localPage);
                  const blobPath = `books/${bookId}/pages/${pageNumber}.webp`;
                  const blob = await put(blobPath, processed.imageWebp, {
                    access: "public",
                    token: process.env.BLOB_READ_WRITE_TOKEN!,
                    contentType: "image/webp",
                    allowOverwrite: true,
                  });

                  await db
                    .insert(bookPages)
                    .values({
                      bookId,
                      pageNumber,
                      imageUrl: blob.url,
                      textContent: sanitizePostgresUtf8Text(
                        processed.textContent,
                      ),
                      chapterTitle: sanitizePostgresUtf8Text(
                        entry.chapterTitle,
                      ),
                      chapterNumber: entry.chapterNumber,
                      isChapterStart: entry.localPage === 1,
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
                  const detail =
                    err instanceof Error ? err.message : String(err);
                  throw new Error(
                    `Book ${bookId} page ${pageNumber} failed: ${detail}`,
                  );
                }
              }
            } finally {
              for (const p of pdfCache.values()) {
                await p.destroy();
              }
            }
          } else {
            const buffer = await fetchBookPdfBuffer(storagePathOrUrl);
            const pdf = await loadPdfDocumentFromBuffer(buffer);
            try {
              for (
                let pageNumber = batch.from;
                pageNumber <= batch.to;
                pageNumber++
              ) {
                if (skipPages.has(pageNumber)) {
                  continue;
                }

                const ch = chapterMetaForPage(pageNumber, ranges);
                const chapterId = chapterIdByNumber.get(ch.chapterNumber);
                if (!chapterId) {
                  throw new Error(
                    `No chapter id for chapter number ${ch.chapterNumber}`,
                  );
                }

                try {
                  const processed = await processPdfPage(pdf, pageNumber);
                  const blobPath = `books/${bookId}/pages/${pageNumber}.webp`;
                  const blob = await put(blobPath, processed.imageWebp, {
                    access: "public",
                    token: process.env.BLOB_READ_WRITE_TOKEN!,
                    contentType: "image/webp",
                    // Inngest retries re-run the whole batch; paths are deterministic per page.
                    allowOverwrite: true,
                  });

                  await db
                    .insert(bookPages)
                    .values({
                      bookId,
                      pageNumber,
                      imageUrl: blob.url,
                      textContent: sanitizePostgresUtf8Text(
                        processed.textContent,
                      ),
                      chapterTitle: sanitizePostgresUtf8Text(ch.chapterTitle),
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
                } catch (err) {
                  const detail =
                    err instanceof Error ? err.message : String(err);
                  throw new Error(
                    `Book ${bookId} page ${pageNumber} failed: ${detail}`,
                  );
                }
              }
            } finally {
              await pdf.destroy();
            }
          }

          return {
            from: batch.from,
            to: batch.to,
            pageCount: batch.to - batch.from + 1,
          };
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

        const chapterIds = chapterRows.map((c) => c.id);
        if (chapterIds.length) {
          await db
            .delete(pdfChunks)
            .where(inArray(pdfChunks.chapterId, chapterIds));
        }

        let chunksTotal = 0;
        const pageBatch = BOOK_PDF_CHUNK_BUILD_DB_PAGE_BATCH;

        for (const ch of chapterRows) {
          let order = 0;
          for (
            let winStart = ch.startPage;
            winStart <= ch.endPage;
            winStart += pageBatch
          ) {
            const winEnd = Math.min(winStart + pageBatch - 1, ch.endPage);
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
            .innerJoin(chapters, eq(pdfChunks.chapterId, chapters.id))
            .where(
              and(
                eq(chapters.bookId, bookId),
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
