"use client";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChapterReaderScrollSync } from "@/modules/chapters/ui/use-chapter-reader-scroll-sync";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  MicOff,
  Pause,
  PhoneOff,
  Play,
  TextQuote,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useGeminiLiveWebSocket } from "./use-gemini-live-ws";

function transcriptDeltaFromGeminiServerMessage(raw: string): string | null {
  try {
    const msg = JSON.parse(raw) as Record<string, unknown>;
    const outText =
      (msg.outputTranscription as { text?: string } | undefined)?.text ??
      (
        msg.serverContent as
          | { outputTranscription?: { text?: string } }
          | undefined
      )?.outputTranscription?.text;
    if (typeof outText === "string" && outText.length > 0) {
      return outText;
    }
    const inText =
      (msg.inputTranscription as { text?: string } | undefined)?.text ??
      (
        msg.serverContent as
          | { inputTranscription?: { text?: string } }
          | undefined
      )?.inputTranscription?.text;
    if (typeof inText === "string" && inText.length > 0) {
      return `\n[You] ${inText}\n`;
    }
    return null;
  } catch {
    return null;
  }
}

type TutorSessionViewProps = {
  sessionId: string;
};

export function TutorSessionView({ sessionId }: TutorSessionViewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const segmentsScrollRef = useRef<HTMLDivElement>(null);
  const textbookScrollRef = useRef<HTMLDivElement>(null);
  const transcriptBuf = useRef("");
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [localChunkIdx, setLocalChunkIdx] = useState(0);

  const sessionQuery = useQuery(
    trpc.learning.getSession.queryOptions({ sessionId }),
  );
  const chunksQuery = useQuery(
    trpc.learning.getSessionChunks.queryOptions(
      { sessionId },
      { enabled: Boolean(sessionQuery.data?.session) },
    ),
  );

  const chunks = chunksQuery.data?.chunks ?? [];
  const session = sessionQuery.data?.session;
  const meta = sessionQuery.data;

  useEffect(() => {
    if (session?.currentChunkIndex != null) {
      setLocalChunkIdx(session.currentChunkIndex);
    }
  }, [session?.currentChunkIndex, session?.id]);

  const activeChunk = chunks[localChunkIdx] ?? null;

  const appendTranscript = useMutation(
    trpc.learning.appendTranscript.mutationOptions({
      onError: (e) => toast.error(e.message),
    }),
  );

  const flushTranscript = useCallback(() => {
    const delta = transcriptBuf.current;
    if (!delta) return;
    transcriptBuf.current = "";
    appendTranscript.mutate({ sessionId, delta });
  }, [appendTranscript, sessionId]);

  const realtime = useGeminiLiveWebSocket({
    onServerJson: (raw) => {
      const d = transcriptDeltaFromGeminiServerMessage(raw);
      if (d) {
        transcriptBuf.current += d;
      }
    },
  });

  useEffect(() => {
    flushTimer.current = setInterval(() => flushTranscript(), 2500);
    return () => {
      if (flushTimer.current) clearInterval(flushTimer.current);
      flushTranscript();
    };
  }, [flushTranscript]);

  const updateProgress = useMutation(
    trpc.learning.updateProgress.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.learning.getSession.queryOptions({ sessionId }),
        );
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const pauseSession = useMutation(
    trpc.learning.pauseSession.mutationOptions({
      onSuccess: () => {
        realtime.disconnect();
        void queryClient.invalidateQueries(
          trpc.learning.getSession.queryOptions({ sessionId }),
        );
        toast.success("Session paused");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const resumeSession = useMutation(
    trpc.learning.resumeSession.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.learning.getSession.queryOptions({ sessionId }),
        );
        toast.success("Session resumed");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const completeSession = useMutation(
    trpc.learning.completeSession.mutationOptions({
      onSuccess: () => {
        realtime.disconnect();
        void queryClient.invalidateQueries(
          trpc.learning.getSession.queryOptions({ sessionId }),
        );
        void queryClient.invalidateQueries(
          trpc.learning.listMySessions.queryOptions(),
        );
        toast.success("Session completed");
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const getLiveSession = useMutation(
    trpc.learning.getGeminiLiveSession.mutationOptions({
      onError: (e) => toast.error(e.message),
    }),
  );

  const goChunk = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= chunks.length) return;
    const ch = chunks[nextIdx];
    if (!ch) return;
    setLocalChunkIdx(nextIdx);
    updateProgress.mutate({
      sessionId,
      chunkId: ch.id,
      orderInChapter: ch.orderInChapter,
    });
  };

  const readCurrentChunkAloud = () => {
    if (!activeChunk) {
      toast.error("No chunk selected");
      return;
    }
    if (realtime.state !== "connected") {
      toast.error("Connect voice first");
      return;
    }
    const text = activeChunk.speakText?.trim() || activeChunk.text?.trim();
    if (!text) {
      toast.error("This segment has no readable text");
      return;
    }
    const prompt = `Read this textbook segment aloud in a clear teaching voice using the same language as the text. Keep it brief and natural, then pause.\n\n"""${text.slice(0, 1500)}"""`;
    const ok = realtime.sendRealtimeText(prompt);
    if (!ok) {
      toast.error("Could not send to tutor (connection closed)");
    }
  };

  const onConnectVoice = async () => {
    try {
      const creds = await getLiveSession.mutateAsync({ sessionId });
      await realtime.connect({
        accessToken: creds.accessToken,
        setupMessage: creds.setupMessage as Record<string, unknown>,
        kickoffClientMessage: creds.kickoffClientMessage as
          | Record<string, unknown>
          | undefined,
      });
    } catch {
      /* toast from mutation / hook */
    }
  };

  const syncKey = useMemo(
    () =>
      `${sessionId}-${chunks.length}-${localChunkIdx}-${activeChunk?.pageNumber ?? 0}`,
    [sessionId, chunks.length, localChunkIdx, activeChunk?.pageNumber],
  );

  useChapterReaderScrollSync({
    leftRef: segmentsScrollRef,
    rightRef: textbookScrollRef,
    enabled:
      Boolean(chunks.length && activeChunk?.imageUrl) &&
      !sessionQuery.isPending &&
      !chunksQuery.isPending,
    syncKey,
  });

  if (sessionQuery.isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading session…
      </div>
    );
  }

  if (sessionQuery.error || !session || !meta) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-3">
        <p className="text-destructive text-sm">
          {sessionQuery.error?.message ?? "Session not found."}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/study-materials">Back to study materials</Link>
        </Button>
      </div>
    );
  }

  if (session.status === "COMPLETED") {
    return (
      <div className="flex flex-col flex-1 min-h-0 px-4 py-6 lg:px-6 max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" className="w-fit gap-2" asChild>
          <Link href={`/study-materials/chapters/${session.chapterId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to chapter
          </Link>
        </Button>
        <Badge variant="secondary">Completed</Badge>
        <h1 className="text-2xl font-semibold">{meta.chapterTitle}</h1>
        {session.summary ? (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">Summary</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {session.summary}
            </p>
          </div>
        ) : null}
        {session.aiNotes ? (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">Notes for review</p>
            <p className="text-sm whitespace-pre-wrap">{session.aiNotes}</p>
          </div>
        ) : null}
      </div>
    );
  }

  const canOperate = session.status === "ACTIVE" || session.status === "PAUSED";
  const tutorSeed = `${meta.chapterTitle}-${meta.bookTitle}-tutor`;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Meet-style top bar */}
      <header className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2.5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-2 text-zinc-300 hover:text-white hover:bg-zinc-800"
        >
          <Link href={`/study-materials/chapters/${session.chapterId}`}>
            <ArrowLeft className="h-4 w-4" />
            Leave
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate text-white">
            {meta.chapterTitle}
          </p>
          <p className="text-xs text-zinc-500 truncate">{meta.bookTitle}</p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "border-zinc-600 text-zinc-300",
            session.status === "ACTIVE" &&
              "border-emerald-600/60 text-emerald-400",
          )}
        >
          {session.status}
        </Badge>
        {session.status === "PAUSED" ? (
          <Button
            size="sm"
            variant="secondary"
            className="bg-zinc-800 text-white"
            disabled={resumeSession.isPending}
            onClick={() => resumeSession.mutate({ sessionId })}
          >
            <Play className="h-4 w-4 mr-1" />
            Resume
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="text-zinc-300 hover:bg-zinc-800"
          disabled={!canOperate || pauseSession.isPending}
          onClick={() => pauseSession.mutate({ sessionId })}
        >
          <Pause className="h-4 w-4 mr-1" />
          Pause
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="bg-red-600 hover:bg-red-700"
          disabled={!canOperate || completeSession.isPending}
          onClick={() => completeSession.mutate({ sessionId })}
        >
          <PhoneOff className="h-4 w-4 mr-1" />
          End
        </Button>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* Center stage — “video” tile for the AI tutor (audio is real; avatar is visual anchor) */}
        <section className="relative flex flex-1 min-h-[280px] min-w-0 flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black px-6 py-8">
          <div
            className={cn(
              "relative mb-6 rounded-full p-1 transition-all duration-500",
              realtime.state === "connected"
                ? "shadow-[0_0_48px_rgba(139,92,246,0.35)] ring-2 ring-violet-500/60 animate-pulse"
                : "ring-1 ring-zinc-700",
            )}
          >
            <GeneratedAvatar
              seed={tutorSeed}
              variant="bottsNeutral"
              className="size-28 sm:size-36 rounded-full border-4 border-zinc-800 bg-zinc-900"
            />
          </div>
          <h2 className="text-lg font-semibold text-white tracking-tight">
            AI tutor
          </h2>
          <p className="mt-1 text-center text-sm text-zinc-400 max-w-md">
            {realtime.state === "connected"
              ? "You’re connected — ask questions or use “Read segment” to narrate the current part."
              : "Connect voice to start speaking with your tutor about this chapter."}
          </p>

          {realtime.lastError ? (
            <p className="mt-4 text-center text-xs text-red-400 max-w-md">
              {realtime.lastError}
            </p>
          ) : null}

          {/* Bottom control strip (Meet-like) */}
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3">
            {realtime.state === "connected" ? (
              <Button
                size="lg"
                variant="secondary"
                className="h-14 w-14 rounded-full bg-zinc-800 p-0 hover:bg-zinc-700"
                onClick={() => {
                  flushTranscript();
                  realtime.disconnect();
                }}
              >
                <MicOff className="h-6 w-6" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="h-14 w-14 rounded-full bg-violet-600 p-0 hover:bg-violet-500"
                disabled={
                  !canOperate ||
                  getLiveSession.isPending ||
                  realtime.state === "connecting"
                }
                onClick={() => void onConnectVoice()}
              >
                {realtime.state === "connecting" || getLiveSession.isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </Button>
            )}
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-full border-zinc-600 bg-zinc-900/80 px-5 text-sm text-white hover:bg-zinc-800"
              disabled={!canOperate || realtime.state !== "connected"}
              onClick={() => readCurrentChunkAloud()}
            >
              Read segment
            </Button>
            <div className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-900/80 p-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full text-zinc-300"
                disabled={localChunkIdx <= 0}
                onClick={() => goChunk(localChunkIdx - 1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="px-2 text-xs tabular-nums text-zinc-400">
                {chunks.length ? localChunkIdx + 1 : 0}/{chunks.length}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-10 w-10 rounded-full text-zinc-300"
                disabled={localChunkIdx >= chunks.length - 1}
                onClick={() => goChunk(localChunkIdx + 1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Right rail — textbook + segments (scroll-synced) */}
        <aside className="flex w-full min-h-0 flex-col border-t border-zinc-800 bg-card text-card-foreground lg:w-[min(100%,420px)] lg:border-l lg:border-t-0">
          <div className="flex max-h-[45vh] min-h-[180px] flex-1 flex-col border-b border-border">
            <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Textbook
              </span>
            </div>
            <div
              ref={textbookScrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
            >
              {!activeChunk?.imageUrl ? (
                <p className="text-muted-foreground text-sm">
                  Pick a segment below to load the matching page.
                </p>
              ) : (
                <figure
                  className="rounded-lg border bg-background p-2 shadow-sm scroll-mt-3"
                  data-reader-page={activeChunk.pageNumber}
                  data-reader-anchor="page"
                >
                  <figcaption className="text-xs text-muted-foreground mb-2 tabular-nums">
                    Page {activeChunk.pageNumber}
                  </figcaption>
                  <div className="relative w-full overflow-hidden rounded">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs */}
                    <img
                      src={activeChunk.imageUrl}
                      alt={`Textbook page ${activeChunk.pageNumber}`}
                      className="h-auto w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                </figure>
              )}
            </div>
          </div>

          <div className="flex min-h-[200px] max-h-[40vh] flex-1 flex-col lg:max-h-none">
            <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
              <TextQuote className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Segments
              </span>
            </div>
            <div
              ref={segmentsScrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
            >
              {chunksQuery.isPending ? (
                <div className="flex justify-center py-8 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading…
                </div>
              ) : chunks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No segments.</p>
              ) : (
                <ol className="space-y-3 list-decimal pl-4 text-sm leading-snug">
                  {chunks.map((c, idx) => {
                    const isFirstOnPage =
                      idx === 0 || chunks[idx - 1]!.pageNumber !== c.pageNumber;
                    const active = idx === localChunkIdx;
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "scroll-mt-2 rounded-md pl-1",
                          active && "bg-primary/10 ring-1 ring-primary/25",
                        )}
                        data-reader-page={c.pageNumber}
                        {...(isFirstOnPage
                          ? { "data-reader-anchor": "segment" as const }
                          : {})}
                      >
                        <button
                          type="button"
                          className="w-full py-1 text-left"
                          onClick={() => goChunk(idx)}
                        >
                          <span className="text-[10px] text-muted-foreground tabular-nums block">
                            Seg {c.orderInChapter + 1} · p.{c.pageNumber}
                          </span>
                          <span className="line-clamp-3 whitespace-pre-wrap">
                            {c.speakText || c.text || "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </aside>
      </div>

      <p className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-[11px] text-zinc-500">
        Voice uses Google Gemini Live (AI Studio). Transcript is saved for your
        end-of-session summary.
      </p>
    </div>
  );
}
