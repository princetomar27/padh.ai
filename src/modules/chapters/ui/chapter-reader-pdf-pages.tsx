"use client";

import { Loader2 } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

/** Keep in sync with `package.json` → `pdfjs-dist`. */
const PDFJS_DIST_VERSION = "5.6.205";

type PdfReaderMode = "chapter_file" | "book_file";

type PdfJsModule = typeof import("pdfjs-dist");

type ChapterReaderPdfPagesProps = {
  chapterId: string;
  startPage: number;
  endPage: number;
  pdfReaderMode: PdfReaderMode;
};

/**
 * Renders textbook pages from the **source PDF** (via `/api/reader/chapter/.../pdf`)
 * using pdf.js. Uses `data-reader-page` for scroll sync with the segment list.
 *
 * The ingest pipeline still uploads WebP previews to Blob for tutoring; the reader
 * uses the original PDF so a blocked / misconfigured Blob store does not break study.
 *
 * We load pdf.js from the same version on unpkg with `webpackIgnore` so Next.js dev
 * does not wrap `pdfjs-dist/build/pdf.mjs` in eval-source-map (that triggers
 * `Object.defineProperty called on non-object` — see mozilla/pdf.js#20478).
 */
export function ChapterReaderPdfPages({
  chapterId,
  startPage,
  endPage,
  pdfReaderMode,
}: ChapterReaderPdfPagesProps) {
  const pagesHostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const pagesHost = pagesHostRef.current;
    if (!pagesHost) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setStatus("loading");
      setErrorMessage(null);
      pagesHost.innerHTML = "";

      let pdf: PDFDocumentProxy | null = null;

      try {
        const pdfjs = (await import(
          /* webpackIgnore: true */
          `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/build/pdf.min.mjs`
        )) as PdfJsModule;
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/build/pdf.worker.min.mjs`;

        const url = `/api/reader/chapter/${encodeURIComponent(chapterId)}/pdf`;
        const loadingTask = pdfjs.getDocument({
          url,
          withCredentials: true,
        });
        pdf = await loadingTask.promise;
        if (cancelled) {
          return;
        }

        const measureEl = pagesHost.parentElement ?? pagesHost;
        const hostWidth = Math.max(
          240,
          measureEl.getBoundingClientRect().width || 320,
        );

        const appendPage = async (
          pdfPageNumber: number,
          globalBookPageNumber: number,
        ) => {
          const page = await pdf!.getPage(pdfPageNumber);
          const base = page.getViewport({ scale: 1 });
          const padding = 16;
          const targetCssWidth = Math.min(
            hostWidth - padding,
            Math.max(280, window.innerWidth - 48),
          );
          const scale = Math.min(
            1.85,
            Math.max(0.85, targetCssWidth / base.width),
          );
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            return;
          }
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block h-auto max-w-full w-full";
          const renderTask = page.render({ canvasContext: ctx, viewport });
          await renderTask.promise;

          const figure = document.createElement("figure");
          figure.className =
            "mx-auto w-full max-w-full rounded-md border border-border bg-background p-2 shadow-sm scroll-mt-4";
          figure.dataset.readerPage = String(globalBookPageNumber);
          figure.dataset.readerAnchor = "page";

          const cap = document.createElement("figcaption");
          cap.className = "text-xs text-muted-foreground mb-2 tabular-nums";
          cap.textContent = `Page ${globalBookPageNumber}`;

          const wrap = document.createElement("div");
          wrap.className =
            "relative flex w-full max-w-full justify-center overflow-x-auto overflow-y-hidden rounded";
          wrap.appendChild(canvas);

          figure.appendChild(cap);
          figure.appendChild(wrap);
          pagesHost.appendChild(figure);
        };

        if (pdfReaderMode === "chapter_file") {
          for (let i = 1; i <= pdf.numPages; i++) {
            if (cancelled) break;
            const globalPage = startPage + i - 1;
            await appendPage(i, globalPage);
          }
        } else {
          for (
            let globalPage = startPage;
            globalPage <= endPage;
            globalPage++
          ) {
            if (cancelled) break;
            await appendPage(globalPage, globalPage);
          }
        }

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMessage(msg);
        setStatus("error");
      } finally {
        if (pdf) {
          await pdf.destroy().catch(() => {});
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      pagesHost.innerHTML = "";
    };
  }, [chapterId, startPage, endPage, pdfReaderMode]);

  return (
    <div className="space-y-6">
      {status === "loading" && (
        <div className="flex justify-center items-center gap-2 py-12 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading PDF pages…
        </div>
      )}
      {status === "error" && (
        <p className="text-destructive text-sm text-center py-8">
          {errorMessage ?? "Could not load the textbook PDF."}
        </p>
      )}
      <div
        ref={pagesHostRef}
        className={status === "loading" ? "hidden" : "space-y-6"}
        aria-hidden={status === "loading"}
      />
    </div>
  );
}
