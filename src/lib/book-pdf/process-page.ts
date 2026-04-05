import "server-only";

import { createCanvas } from "@napi-rs/canvas";
import sharp from "sharp";
import type { PDFDocumentProxy, TextItem as PdfjsTextItem } from "pdfjs-dist/types/src/display/api";
import { PDF_RENDER_SCALE } from "./constants";

export type StoredTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
};

export type PageProcessMetadata = {
  pageWidth: number;
  pageHeight: number;
  textItems: StoredTextItem[];
};

const MATH_SYMBOL_RE =
  /[∫∑√∂πθλμΩΔΣΠ≤≥≠±×÷∞∈∅→↔∝∼]/u;

function isPdfjsTextItem(item: unknown): item is PdfjsTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str: unknown }).str === "string"
  );
}

function detectEquationHeuristic(text: string): boolean {
  if (MATH_SYMBOL_RE.test(text)) return true;
  if (/\\\(|\\\[|\$\$|\$[^$]+\$/.test(text)) return true;
  if (/=\s*[^=\n]{0,40}\+[^=\n]{0,40}=/.test(text)) return true;
  return false;
}

/**
 * Render one PDF page to WebP, extract positioned text for chunking.
 */
export async function processPdfPage(
  pdf: PDFDocumentProxy,
  pageNumber: number,
): Promise<{
  textContent: string;
  metadata: PageProcessMetadata;
  hasEquations: boolean;
  hasImages: boolean;
  imageWebp: Buffer;
}> {
  const page = await pdf.getPage(pageNumber);
  const pdfViewport = page.getViewport({ scale: 1 });
  const renderViewport = page.getViewport({ scale: PDF_RENDER_SCALE });

  const canvas = createCanvas(
    Math.ceil(renderViewport.width),
    Math.ceil(renderViewport.height),
  );
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable");
  }

  const renderTask = page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport: renderViewport,
  });
  await renderTask.promise;

  const pngBuffer = await canvas.encode("png");
  const imageWebp = await sharp(pngBuffer).webp({ quality: 82 }).toBuffer();

  const textContent = await page.getTextContent();
  const items = textContent.items.filter(isPdfjsTextItem).map((item) => ({
    str: item.str,
    transform: [...item.transform] as number[],
    width: item.width,
    height: typeof item.height === "number" && item.height > 0 ? item.height : 0,
  }));

  const joined = items
    .map((i) => i.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const hasEquations = items.some((i) => detectEquationHeuristic(i.str));
  /** Diagram-only pages: v1 leaves hasImages false unless we add operator-list scan. */
  const hasImages = false;

  return {
    textContent: joined,
    metadata: {
      pageWidth: pdfViewport.width,
      pageHeight: pdfViewport.height,
      textItems: items,
    },
    hasEquations,
    hasImages,
    imageWebp,
  };
}
