"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center gap-3">
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

      <div>
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
          <p className="text-sm mt-3 text-foreground/90">{chapter.description}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Full chapter text</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">
            Processed segments (speakText) in reading order — same content the AI
            tutor uses, without PDF coordinates.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {accumulated.length === 0 && nextAfter === null && !loadingMore ? (
            <p className="text-muted-foreground text-sm py-6 text-center">
              No segments yet. Re-run book processing if this should not be empty.
            </p>
          ) : (
            <ol className="space-y-4 list-decimal pl-5 text-sm leading-relaxed">
              {accumulated.map((c) => (
                <li key={c.id} className="pl-1">
                  <span className="text-xs text-muted-foreground tabular-nums block mb-1">
                    Segment {c.orderInChapter + 1} · PDF page {c.pageNumber}
                  </span>
                  <span className="whitespace-pre-wrap">{c.speakText}</span>
                </li>
              ))}
            </ol>
          )}

          {nextAfter != null && (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
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
        </CardContent>
      </Card>
    </div>
  );
}
