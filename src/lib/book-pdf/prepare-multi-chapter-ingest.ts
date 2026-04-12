import "server-only";

import { db } from "@/db";
import { books, chapters, bookPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { loadPdfDocumentFromBuffer } from "@/lib/book-pdf/pdf-loader";
import { sanitizePostgresUtf8Text } from "@/lib/book-pdf/sanitize-postgres-text";
import { fetchBookPdfBuffer } from "@/lib/supabase/fetch-book-pdf";

export type ChapterPdfSource = {
  chapterNumber: number;
  supabaseStorageUrl: string;
  title?: string;
};

/** Payload for `padhai/book.chapter.process` (one Inngest run per chapter). */
export type ChapterIngestDispatch = {
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  supabaseStorageUrl: string;
  title?: string;
  startPage: number;
  endPage: number;
};

/**
 * Wipes existing chapter/page rows for the book, probes each chapter PDF,
 * inserts `chapters` with global `startPage`/`endPage`, updates `books.total_pages`.
 * Does not touch `book_processing_jobs` or Inngest.
 */
export async function prepareMultiChapterIngest(input: {
  bookId: string;
  bookTitle: string;
  subjectId: string;
  classId: string;
  sources: ChapterPdfSource[];
}): Promise<ChapterIngestDispatch[]> {
  const { bookId, bookTitle, subjectId, classId } = input;
  const sources = [...input.sources].sort(
    (a, b) => a.chapterNumber - b.chapterNumber,
  );
  if (sources.length === 0) {
    throw new Error("prepareMultiChapterIngest: no chapter PDF sources");
  }

  await db.delete(chapters).where(eq(chapters.bookId, bookId));
  await db.delete(bookPages).where(eq(bookPages.bookId, bookId));

  let globalPage = 1;
  const rangeInserts: {
    chapterNumber: number;
    title: string;
    startPage: number;
    endPage: number;
  }[] = [];
  const urlByChapter = new Map<number, string>();

  for (const src of sources) {
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
      src.title?.trim() || `${bookTitle} · Chapter ${src.chapterNumber}`,
    );
    const startPage = globalPage;
    const endPage = globalPage + np - 1;
    rangeInserts.push({
      chapterNumber: src.chapterNumber,
      title: chTitle,
      startPage,
      endPage,
    });
    urlByChapter.set(src.chapterNumber, src.supabaseStorageUrl);
    globalPage += np;
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
    rangeInserts.map((r) => ({
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
      startPage: chapters.startPage,
      endPage: chapters.endPage,
      title: chapters.title,
    })
    .from(chapters)
    .where(eq(chapters.bookId, bookId))
    .orderBy(asc(chapters.chapterNumber));

  return inserted.map((row) => ({
    bookId,
    chapterId: row.id,
    chapterNumber: row.chapterNumber,
    supabaseStorageUrl: urlByChapter.get(row.chapterNumber)!,
    title: row.title,
    startPage: row.startPage,
    endPage: row.endPage,
  }));
}
