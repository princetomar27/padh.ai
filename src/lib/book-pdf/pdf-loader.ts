import "server-only";

import path from "node:path";
import { pathToFileURL } from "node:url";
import type { PDFDocumentProxy } from "pdfjs-dist";

function pdfDistBaseUrl(): string {
  const dir = path.join(process.cwd(), "node_modules", "pdfjs-dist");
  return pathToFileURL(dir).href + "/";
}

export async function loadPdfDocumentFromBuffer(
  buffer: Buffer,
): Promise<PDFDocumentProxy> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const base = pdfDistBaseUrl();
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
  });
  return loadingTask.promise;
}
