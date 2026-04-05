import "server-only";

import type { PageProcessMetadata } from "./process-page";
import { sanitizePostgresUtf8Text } from "./sanitize-postgres-text";

export type ChunkInsert = {
  chunkIndex: number;
  orderInChapter: number;
  text: string;
  speakText: string;
  boundingBoxes: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    pageWidth: number;
    pageHeight: number;
  }>;
  isEquation: boolean;
  isImage: boolean;
};

type TextItem = PageProcessMetadata["textItems"][number];

function itemRect(item: TextItem): { x: number; y: number; w: number; h: number } {
  const [, , , , e, f] = item.transform;
  const w = item.width;
  const h =
    item.height > 0
      ? item.height
      : Math.hypot(item.transform[2], item.transform[3]) || 10;
  return { x: e, y: f - h, w, h: h > 0 ? h : 10 };
}

function unionRect(
  rects: { x: number; y: number; w: number; h: number }[],
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const MATH_SYMBOL_RE =
  /[∫∑√∂πθλμΩΔΣΠ≤≥≠±×÷∞∈∅→↔∝∼]/u;

function looksLikeEquation(text: string): boolean {
  if (MATH_SYMBOL_RE.test(text)) return true;
  return /\\\(|\\\[|\$\$/.test(text);
}

/**
 * Group positioned text into paragraph-level chunks for tutoring.
 */
export function buildChunksFromPageMetadata(
  meta: PageProcessMetadata,
  startOrderInChapter: number,
): { chunks: ChunkInsert[]; nextOrder: number } {
  const { pageWidth, pageHeight, textItems } = meta;
  if (textItems.length === 0) {
    const fallback =
      "This page is mostly visual content. Refer to the textbook diagram and labels while studying.";
    const chunk: ChunkInsert = {
      chunkIndex: 0,
      orderInChapter: startOrderInChapter,
      text: fallback,
      speakText: fallback,
      boundingBoxes: [
        {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          pageWidth,
          pageHeight,
        },
      ],
      isEquation: false,
      isImage: true,
    };
    return { chunks: [chunk], nextOrder: startOrderInChapter + 1 };
  }

  const sorted = [...textItems].sort((a, b) => {
    const ya = a.transform[5];
    const yb = b.transform[5];
    if (Math.abs(ya - yb) > 2) return yb - ya;
    return a.transform[4] - b.transform[4];
  });

  const medianH =
    sorted
      .map((i) => (i.height > 0 ? i.height : itemRect(i).h))
      .sort((a, b) => a - b)[Math.floor(sorted.length / 2)] || 12;

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let lastY: number | null = null;

  for (const item of sorted) {
    const y = item.transform[5];
    if (lastY === null || Math.abs(y - lastY) <= medianH * 0.35) {
      currentLine.push(item);
    } else {
      if (currentLine.length) {
        currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
        lines.push(currentLine);
      }
      currentLine = [item];
    }
    lastY = y;
  }
  if (currentLine.length) {
    currentLine.sort((a, b) => a.transform[4] - b.transform[4]);
    lines.push(currentLine);
  }

  const paragraphs: TextItem[][] = [];
  let para: TextItem[] = [];
  let prevBaseY: number | null = null;

  for (const line of lines) {
    const lineYs = line.map((i) => i.transform[5]);
    const baseY = Math.max(...lineYs);
    if (prevBaseY !== null && prevBaseY - baseY > medianH * 1.65) {
      if (para.length) paragraphs.push(para);
      para = [...line];
    } else {
      para.push(...line);
    }
    prevBaseY = baseY;
  }
  if (para.length) paragraphs.push(para);

  const chunks: ChunkInsert[] = [];
  let order = startOrderInChapter;

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const items = paragraphs[pi];
    const rawText = items
      .map((i) => i.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const text = sanitizePostgresUtf8Text(rawText);
    if (!text) continue;

    const rects = items.map(itemRect);
    const u = unionRect(rects);
    const isEquation = looksLikeEquation(text);
    const speakText = sanitizePostgresUtf8Text(
      isEquation
        ? `There is a mathematical expression on this page: ${text}. Listen carefully and compare with how it is written in your book.`
        : text,
    );

    chunks.push({
      chunkIndex: chunks.length,
      orderInChapter: order++,
      text,
      speakText,
      boundingBoxes: [
        {
          x: u.x,
          y: u.y,
          width: u.width,
          height: u.height,
          pageWidth,
          pageHeight,
        },
      ],
      isEquation,
      isImage: false,
    });
  }

  if (chunks.length === 0) {
    const fallback =
      "This page is mostly visual content. Refer to the textbook diagram and labels while studying.";
    chunks.push({
      chunkIndex: 0,
      orderInChapter: order++,
      text: fallback,
      speakText: fallback,
      boundingBoxes: [
        {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          pageWidth,
          pageHeight,
        },
      ],
      isEquation: false,
      isImage: true,
    });
  }

  return { chunks, nextOrder: order };
}
