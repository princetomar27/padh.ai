import "server-only";

import type { PDFDocumentProxy } from "pdfjs-dist";

export type ChapterRange = {
  chapterNumber: number;
  title: string;
  startPage: number;
  endPage: number;
};

type OutlineNode = {
  title: string;
  dest: string | unknown[] | null;
  items: OutlineNode[];
};

async function destinationToPageNumber(
  pdf: PDFDocumentProxy,
  dest: string | unknown[] | null,
): Promise<number | null> {
  if (!dest) return null;
  try {
    let explicit: unknown = dest;
    if (typeof dest === "string") {
      explicit = await pdf.getDestination(dest);
    }
    if (!Array.isArray(explicit) || explicit.length === 0) return null;
    const ref = explicit[0];
    if (ref && typeof ref === "object") {
      const idx = await pdf.getPageIndex(
        ref as Parameters<PDFDocumentProxy["getPageIndex"]>[0],
      );
      return idx + 1;
    }
    return null;
  } catch {
    return null;
  }
}

async function flattenOutline(
  pdf: PDFDocumentProxy,
  nodes: OutlineNode[],
  acc: { title: string; page: number }[],
): Promise<void> {
  for (const node of nodes) {
    const page = await destinationToPageNumber(pdf, node.dest);
    if (page !== null && node.title?.trim()) {
      acc.push({ title: node.title.trim(), page });
    }
    if (node.items?.length) {
      await flattenOutline(pdf, node.items, acc);
    }
  }
}

function dedupeByPage(
  entries: { title: string; page: number }[],
): { title: string; page: number }[] {
  const map = new Map<number, string>();
  for (const e of entries) {
    const prev = map.get(e.page);
    if (!prev || e.title.length > prev.length) {
      map.set(e.page, e.title);
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([page, title]) => ({ page, title }));
}

function rangesFromOutlineEntries(
  sorted: { title: string; page: number }[],
  numPages: number,
  bookTitle: string,
): ChapterRange[] {
  if (sorted.length === 0) {
    return [
      {
        chapterNumber: 1,
        title: bookTitle,
        startPage: 1,
        endPage: numPages,
      },
    ];
  }

  const ranges: ChapterRange[] = [];
  let chapterNum = 1;

  if (sorted[0].page > 1) {
    ranges.push({
      chapterNumber: chapterNum++,
      title: "Front matter",
      startPage: 1,
      endPage: sorted[0].page - 1,
    });
  }

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const nextStart = sorted[i + 1]?.page ?? numPages + 1;
    ranges.push({
      chapterNumber: chapterNum++,
      title: cur.title || `Chapter ${chapterNum}`,
      startPage: cur.page,
      endPage: Math.min(nextStart - 1, numPages),
    });
  }

  const valid = ranges.filter(
    (r) => r.startPage <= r.endPage && r.startPage >= 1,
  );
  if (valid.length === 0) {
    return [
      {
        chapterNumber: 1,
        title: bookTitle,
        startPage: 1,
        endPage: numPages,
      },
    ];
  }
  return valid;
}

/**
 * Resolve NCERT-style outline (if present) into chapter page ranges.
 */
export async function extractChapterRanges(
  pdf: PDFDocumentProxy,
  bookTitle: string,
): Promise<{ numPages: number; ranges: ChapterRange[] }> {
  const numPages = pdf.numPages;
  const outline = await pdf.getOutline();
  const flat: { title: string; page: number }[] = [];
  if (outline?.length) {
    await flattenOutline(pdf, outline as OutlineNode[], flat);
  }
  let sorted = dedupeByPage(flat);
  /** Many PDFs expose a useless outline where every entry resolves to the same page. */
  if (sorted.length >= 1 && numPages >= 20) {
    const uniquePages = new Set(sorted.map((s) => s.page));
    if (uniquePages.size === 1) {
      sorted = [];
    }
  }
  const ranges = rangesFromOutlineEntries(sorted, numPages, bookTitle);
  return { numPages, ranges };
}

export function chapterMetaForPage(
  pageNumber: number,
  ranges: ChapterRange[],
): { chapterNumber: number; chapterTitle: string; isChapterStart: boolean } {
  if (ranges.length === 0) {
    return {
      chapterNumber: 1,
      chapterTitle: "Chapter 1",
      isChapterStart: pageNumber === 1,
    };
  }
  const ordered = [...ranges].sort((a, b) => a.startPage - b.startPage);
  const r =
    ordered.find((x) => pageNumber >= x.startPage && pageNumber <= x.endPage) ??
    ordered[0];
  if (!r) {
    return {
      chapterNumber: 1,
      chapterTitle: "Chapter 1",
      isChapterStart: pageNumber === 1,
    };
  }
  return {
    chapterNumber: r.chapterNumber,
    chapterTitle: r.title,
    isChapterStart: pageNumber === r.startPage,
  };
}
