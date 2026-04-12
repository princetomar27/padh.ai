"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Headphones,
  Loader2,
  TextQuote,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChapterReaderPdfPages } from "./chapter-reader-pdf-pages";
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
  const router = useRouter();
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

  const {
    data: meta,
    isPending: metaPending,
    error: metaError,
  } = useQuery(trpc.chapters.getReaderMeta.queryOptions({ id: chapterId }));

  const startSession = useMutation(
    trpc.learning.startOrResumeSession.mutationOptions({
      onSuccess: (res) => {
        void queryClient.invalidateQueries(
          trpc.learning.listMySessions.queryOptions(),
        );
        router.push(`/study-materials/sessions/${res.session.id}`);
      },
      onError: (e) => toast.error(e.message),
    }),
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
      Boolean(meta && accumulated.length > 0) && !metaPending && !metaError,
    syncKey: `${chapterId}-${meta?.chapter.startPage ?? 0}-${meta?.chapter.endPage ?? 0}-${accumulated.length}`,
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

  const { chapter, viewerRole, pdfReaderMode } = meta;
  const roleLabel =
    viewerRole === "ADMIN"
      ? "Admin preview"
      : viewerRole === "STUDENT"
        ? "Student reader"
        : viewerRole;

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
      <div className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-3 mb-3 sm:mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 shrink-0">
          <Link
            href={backHref}
            className="gap-2 max-w-[min(100%,14rem)] sm:max-w-none"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="truncate">{backLabel}</span>
          </Link>
        </Button>
        <Badge variant="outline" className="shrink-0 text-[11px] sm:text-xs">
          {roleLabel}
        </Badge>
        <Badge variant="secondary" className="shrink-0 text-[11px] sm:text-xs">
          {chapter.processingStatus.replaceAll("_", " ")}
        </Badge>
        {viewerRole === "STUDENT" &&
        chapter.processingStatus === "COMPLETED" ? (
          <Button
            type="button"
            size="sm"
            className="gap-2 shrink-0 w-full sm:ml-auto sm:w-auto"
            disabled={startSession.isPending}
            onClick={() => startSession.mutate({ chapterId })}
          >
            {startSession.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Headphones className="h-4 w-4" />
            )}
            Start session
          </Button>
        ) : null}
      </div>

      <div className="shrink-0 mb-3 sm:mb-4 min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl break-words">
          {chapter.title}
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-1 leading-relaxed break-words">
          {chapter.bookTitle} · {chapter.subjectName} · {chapter.className} ·
          Chapter {chapter.chapterNumber} · Pages {chapter.startPage}–
          {chapter.endPage}
          {chapter.totalChunks > 0 && <> · {chapter.totalChunks} segments</>}
        </p>
        {chapter.description ? (
          <p className="text-sm mt-3 text-foreground/90 max-w-3xl break-words">
            {chapter.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row rounded-lg border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex flex-col min-h-0 min-w-0 flex-1 border-b border-border md:w-1/2 md:max-w-[50%] md:border-b-0 md:border-r max-md:min-h-[min(42svh,28rem)]">
          <div className="shrink-0 flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-border bg-muted/40">
            <TextQuote className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">Chapter text</span>
            <span className="text-[11px] text-muted-foreground sm:text-xs basis-full sm:basis-auto">
              Scroll syncs with the book by page
            </span>
          </div>
          <div
            ref={leftScrollRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-3 sm:p-4"
          >
            {accumulated.length === 0 && nextAfter === null && !loadingMore ? (
              <p className="text-muted-foreground text-sm py-6 text-center">
                No segments yet. Re-run book processing if this should not be
                empty.
              </p>
            ) : (
              <ol className="space-y-6 list-decimal pl-4 sm:pl-5 text-sm leading-relaxed [word-break:break-word]">
                {accumulated.map((c, idx) => {
                  const isFirstOnPage =
                    idx === 0 ||
                    accumulated[idx - 1]!.pageNumber !== c.pageNumber;
                  return (
                    <li
                      key={c.id}
                      className="pl-1 scroll-mt-4 min-w-0"
                      data-reader-page={c.pageNumber}
                      {...(isFirstOnPage
                        ? { "data-reader-anchor": "segment" as const }
                        : {})}
                    >
                      <span className="text-xs text-muted-foreground tabular-nums block mb-1 break-words">
                        Segment {c.orderInChapter + 1} · PDF page {c.pageNumber}
                      </span>
                      <span className="whitespace-pre-wrap break-words">
                        {c.speakText}
                      </span>
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

        <div className="flex flex-col min-h-0 min-w-0 flex-1 bg-muted/20 md:w-1/2 max-md:min-h-[min(42svh,28rem)]">
          <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 border-b border-border bg-muted/40">
            <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">Textbook (PDF)</span>
          </div>
          <div
            ref={rightScrollRef}
            className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-auto overscroll-contain p-3 sm:p-4"
          >
            <ChapterReaderPdfPages
              chapterId={chapterId}
              startPage={chapter.startPage}
              endPage={chapter.endPage}
              pdfReaderMode={pdfReaderMode}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
