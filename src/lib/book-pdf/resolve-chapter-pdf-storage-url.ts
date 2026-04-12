import "server-only";

type ChapterIngestEntry = {
  chapterNumber: number;
  supabaseStorageUrl: string;
};

/**
 * URL or bucket-relative path for the PDF backing this chapter.
 * Per-chapter ingest: the matching chapter's PDF. Otherwise the book's main PDF.
 */
export function resolveChapterPdfStoragePath(
  book: {
    supabaseStorageUrl: string | null;
    chapterIngestSources: unknown;
  },
  chapterNumber: number,
): string {
  const raw = book.chapterIngestSources;
  if (Array.isArray(raw) && raw.length > 0) {
    const match = (raw as ChapterIngestEntry[]).find(
      (e) => e.chapterNumber === chapterNumber,
    );
    if (match?.supabaseStorageUrl?.trim()) {
      return match.supabaseStorageUrl.trim();
    }
  }
  const main = book.supabaseStorageUrl?.trim();
  if (main) {
    return main;
  }
  throw new Error("No PDF storage path for this book/chapter.");
}
