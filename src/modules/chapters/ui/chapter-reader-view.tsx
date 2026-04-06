"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Loader2, TextQuote } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useChapterReaderScrollSync } from "./use-chapter-reader-scroll-sync";

const PAGE_SIZE = 80;

type ChapterReaderViewProps = {
  chapterId: string;
  backHref: string;
  backLabel: string;
};

export function ChapterReaderView({
  chapterId,
  backHref,
  backLabel,
}: ChapterReaderViewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);

  const [accumulated, setAccumulated] = useState<
    {
      id: string;
      orderInChapter: number;
      speakText: string;
      pageNumber: number;
    }[]
  >([]);
  const [nextAfter, setNextAfter] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data: meta, isPending: metaPending, error: metaError } = useQuery(
    trpc.chapters.getReaderMeta.queryOptions({ id: chapterId }),
  );

  const { data: bookPagesData, isPending: pagesPending } = useQuery(
    trpc.chapters.getReaderBookPages.queryOptions(
      { id: chapterId },
      { enabled: Boolean(meta && !metaError) },
    ),
  );

  const resetAndFetchFirst = useCallback(async () => {
    setAccumulated([]);
    setNextAfter(null);
    const first = await queryClient.fetchQuery(
      trpc.chapters.getReaderChunks.queryOptions({
        chapterId,
        afterOrder: -1,
        limit: PAGE_SIZE,
      }),
    );
    setAccumulated(first.chunks);
    setNextAfter(first.nextAfterOrder);
  }, [chapterId, queryClient, trpc.chapters.getReaderChunks]);

  useEffect(() => {
    if (metaPending || metaError || !meta) return;
    void resetAndFetchFirst();
  }, [meta, metaPending, metaError, resetAndFetchFirst]);

  const loadMore = async () => {
    if (nextAfter == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await queryClient.fetchQuery(
        trpc.chapters.getReaderChunks.queryOptions({
          chapterId,
          afterOrder: nextAfter,
          limit: PAGE_SIZE,
        }),
      );
      setAccumulated((prev) => [...prev, ...res.chunks]);
      setNextAfter(res.nextAfterOrder);
    } finally {
      setLoadingMore(false);
    }
  };

  useChapterReaderScrollSync({
    leftRef: leftScrollRef,
    rightRef: rightScrollRef,
    enabled:
      Boolean(bookPagesData?.pages.length && accumulated.length > 0) &&
      !metaPending &&
      !pagesPending,
    syncKey: `${chapterId}-${bookPagesData?.pages.length ?? 0}-${accumulated.length}`,
  });

  if (metaPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading chapter…
      </div>
    );
  }

  if (metaError || !meta) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-3">
        <p className="text-destructive text-sm">
          {metaError?.message ?? "Could not load this chapter."}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={backHref}>{backLabel}</Link>
        </Button>
      </div>
    );
  }

  const { chapter, viewerRole } = meta;
  const roleLabel =
    viewerRole === "ADMIN"
      ? "Admin preview"
      : viewerRole === "STUDENT"
        ? "Student reader"
        : viewerRole;

  const bookPages = bookPagesData?.pages ?? [];

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden px-4 py-4 lg:px-6 lg:py-6">
      <div className="shrink-0 flex flex-wrap items-center gap-3 mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
        <Badge variant="outline">{roleLabel}</Badge>
        <Badge variant="secondary">
          {chapter.processingStatus.replaceAll("_", " ")}
        </Badge>
      </div>

      <div className="shrink-0 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          {chapter.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {chapter.bookTitle} · {chapter.subjectName} · {chapter.className} ·
          Chapter {chapter.chapterNumber} · Pages {chapter.startPage}–
          {chapter.endPage}
          {chapter.totalChunks > 0 && (
            <> · {chapter.totalChunks} segments</>
          )}
        </p>
        {chapter.description ? (
          <p className="text-sm mt-3 text-foreground/90 max-w-3xl">
            {chapter.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex flex-col min-h-0 min-w-0 flex-1 lg:max-w-[50%] border-b lg:border-b-0 lg:border-r border-border">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
            <TextQuote className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Chapter text</span>
            <span className="text-xs text-muted-foreground">
              Scroll syncs with the book by page
            </span>
          </div>
          <div
            ref={leftScrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4"
          >
            {accumulated.length === 0 && nextAfter === null && !loadingMore ? (
              <p className="text-muted-foreground text-sm py-6 text-center">
                No segments yet. Re-run book processing if this should not be
                empty.
              </p>
            ) : (
              <ol className="space-y-6 list-decimal pl-5 text-sm leading-relaxed">
                {accumulated.map((c, idx) => {
                  const isFirstOnPage =
                    idx === 0 ||
                    accumulated[idx - 1]!.pageNumber !== c.pageNumber;
                  return (
                    <li
                      key={c.id}
                      className="pl-1 scroll-mt-4"
                      data-reader-page={c.pageNumber}
                      {...(isFirstOnPage
                        ? { "data-reader-anchor": "segment" as const }
                        : {})}
                    >
                      <span className="text-xs text-muted-foreground tabular-nums block mb-1">
                        Segment {c.orderInChapter + 1} · PDF page{" "}
                        {c.pageNumber}
                      </span>
                      <span className="whitespace-pre-wrap">{c.speakText}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {nextAfter != null && (
              <Button
                type="button"
                variant="secondary"
                className="w-full mt-6"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col min-h-0 min-w-0 flex-1 bg-muted/20">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Textbook pages</span>
            {pagesPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <div
            ref={rightScrollRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-6"
          >
            {pagesPending ? (
              <div className="flex justify-center py-12 text-muted-foreground text-sm">
                Loading pages…
              </div>
            ) : bookPages.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No page images for this chapter span yet.
              </p>
            ) : (
              bookPages.map((p) => (
                <figure
                  key={p.pageNumber}
                  className="rounded-md border border-border bg-background p-2 shadow-sm scroll-mt-4"
                  data-reader-page={p.pageNumber}
                  data-reader-anchor="page"
                >
                  <figcaption className="text-xs text-muted-foreground mb-2 tabular-nums">
                    Page {p.pageNumber}
                  </figcaption>
                  <div className="relative w-full overflow-hidden rounded">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Vercel Blob URLs */}
                    <img
                      src={p.imageUrl}
                      alt={`Textbook page ${p.pageNumber}`}
                      className="h-auto w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                </figure>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
