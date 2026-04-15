"use client";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChapterReaderPdfPages } from "@/modules/chapters/ui/chapter-reader-pdf-pages";
import { useChapterReaderScrollSync } from "@/modules/chapters/ui/use-chapter-reader-scroll-sync";
import { cn } from "@/lib/utils";
import {
  findBestChunkIndexForTutorSpeech,
  type ChunkForMatch,
} from "@/modules/learning/ui/match-chunk-from-tutor-text";
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

/** Model-only speech text for matching to textbook segments (not saved to session transcript). */
function tutorModelTranscriptionDelta(raw: string): string | null {
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
  /** After voice disconnect, allow segment-change nudge to treat next chunk as fresh. */
  const prevVoiceChunkIdRef = useRef<string | null>(null);
  /** Successful auto-connect once per learning session id (manual mic still works). */
  const didAutoVoiceForSessionRef = useRef<string | null>(null);
  const voiceAutoInFlightRef = useRef(false);
  const prevSessionIdForAutoResetRef = useRef<string | null>(null);
  /** Recent tutor (model) output transcription for segment matching. */
  const tutorModelSpeechBuf = useRef("");
  const chunksRef = useRef<ChunkForMatch[]>([]);
  const manualSegmentLockUntilRef = useRef(0);
  const lastAutoProgressAtRef = useRef(0);
  const localChunkIdxRef = useRef(0);
  /** When true, next chunk change should notify the tutor (manual navigation only). */
  const pendingTutorChunkNudgeRef = useRef(false);

  const [localChunkIdx, setLocalChunkIdx] = useState(0);
  const [mainSplitDirection, setMainSplitDirection] = useState<
    "horizontal" | "vertical"
  >("horizontal");

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

  chunksRef.current = chunks;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () =>
      setMainSplitDirection(mq.matches ? "horizontal" : "vertical");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (session?.currentChunkIndex != null) {
      setLocalChunkIdx(session.currentChunkIndex);
    }
  }, [session?.currentChunkIndex, session?.id]);

  const activeChunk = chunks[localChunkIdx] ?? null;

  localChunkIdxRef.current = localChunkIdx;

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

  const onGeminiServerJson = useCallback((raw: string) => {
    const d = transcriptDeltaFromGeminiServerMessage(raw);
    if (d) {
      transcriptBuf.current += d;
    }
    const modelOnly = tutorModelTranscriptionDelta(raw);
    if (modelOnly) {
      tutorModelSpeechBuf.current += modelOnly;
      const cap = 14_000;
      if (tutorModelSpeechBuf.current.length > cap) {
        tutorModelSpeechBuf.current = tutorModelSpeechBuf.current.slice(-cap);
      }
    }
  }, []);

  const realtime = useGeminiLiveWebSocket({
    onServerJson: onGeminiServerJson,
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
    trpc.learning.getGeminiLiveSession.mutationOptions({}),
  );

  const goChunk = (nextIdx: number) => {
    if (nextIdx < 0 || nextIdx >= chunks.length) return;
    const ch = chunks[nextIdx];
    if (!ch) return;
    manualSegmentLockUntilRef.current = Date.now() + 12_000;
    pendingTutorChunkNudgeRef.current = true;
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

  const startVoiceSession = useCallback(
    async (opts?: {
      fromAuto?: boolean;
      whenCancelled?: () => boolean;
    }): Promise<boolean> => {
      try {
        const creds = await getLiveSession.mutateAsync({ sessionId });
        if (opts?.whenCancelled?.()) return false;
        await realtime.connect({
          accessToken: creds.accessToken,
          setupMessage: creds.setupMessage as Record<string, unknown>,
          kickoffClientMessage: creds.kickoffClientMessage as
            | Record<string, unknown>
            | undefined,
        });
        return true;
      } catch (e) {
        if (opts?.whenCancelled?.()) return false;
        const msg = e instanceof Error ? e.message : String(e);
        if (opts?.fromAuto) {
          toast.error(
            "Could not auto-start voice. Tap the microphone button to connect.",
          );
        } else {
          toast.error(msg);
        }
        return false;
      }
    },
    [getLiveSession.mutateAsync, realtime.connect, sessionId],
  );

  const startVoiceSessionRef = useRef(startVoiceSession);
  startVoiceSessionRef.current = startVoiceSession;

  const onConnectVoice = () => void startVoiceSession();

  useEffect(() => {
    if (prevSessionIdForAutoResetRef.current !== sessionId) {
      didAutoVoiceForSessionRef.current = null;
      prevSessionIdForAutoResetRef.current = sessionId;
    }
  }, [sessionId]);

  useEffect(() => {
    if (realtime.state === "idle" || realtime.state === "error") {
      prevVoiceChunkIdRef.current = null;
      tutorModelSpeechBuf.current = "";
    }
  }, [realtime.state]);

  useEffect(() => {
    if (realtime.state !== "connected" || chunks.length === 0) return;

    const tick = () => {
      if (Date.now() < manualSegmentLockUntilRef.current) return;
      const list = chunksRef.current;
      if (!list.length) return;
      const buf = tutorModelSpeechBuf.current;
      const idx = findBestChunkIndexForTutorSpeech(list, buf, {
        minScore: 20,
      });
      if (idx < 0) return;
      if (idx === localChunkIdxRef.current) return;
      const ch = list[idx];
      if (!ch) return;

      setLocalChunkIdx(idx);

      const now = Date.now();
      if (now - lastAutoProgressAtRef.current > 2200) {
        lastAutoProgressAtRef.current = now;
        updateProgress.mutate({
          sessionId,
          chunkId: ch.id,
          orderInChapter: ch.orderInChapter,
        });
      }
    };

    const id = window.setInterval(tick, 700);
    return () => window.clearInterval(id);
  }, [realtime.state, chunks.length, sessionId, updateProgress]);

  useEffect(() => {
    if (session?.status !== "ACTIVE") return;
    if (!chunks.length || chunksQuery.isPending) return;
    if (realtime.state !== "idle") return;
    if (didAutoVoiceForSessionRef.current === sessionId) return;
    if (voiceAutoInFlightRef.current) return;

    let cancelled = false;
    voiceAutoInFlightRef.current = true;
    void (async () => {
      try {
        await startVoiceSessionRef.current({
          fromAuto: true,
          whenCancelled: () => cancelled,
        });
        if (!cancelled) {
          didAutoVoiceForSessionRef.current = sessionId;
        }
      } finally {
        voiceAutoInFlightRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    session?.status,
    chunks.length,
    chunksQuery.isPending,
    realtime.state,
    sessionId,
  ]);

  useEffect(() => {
    if (realtime.state !== "connected" || !activeChunk) return;
    const id = activeChunk.id;
    if (prevVoiceChunkIdRef.current === null) {
      prevVoiceChunkIdRef.current = id;
      return;
    }
    if (prevVoiceChunkIdRef.current === id) return;

    const shouldNudgeTutor = pendingTutorChunkNudgeRef.current;
    pendingTutorChunkNudgeRef.current = false;
    prevVoiceChunkIdRef.current = id;

    if (!shouldNudgeTutor) return;

    const segLabel = activeChunk.orderInChapter + 1;
    const page = activeChunk.pageNumber;
    const ok = realtime.sendRealtimeText(
      `We moved to textbook segment ${segLabel} (PDF page ${page}). Continue teaching from this part — keep it interactive and check my understanding before moving on.`,
    );
    if (!ok) {
      toast.error("Could not notify the tutor (connection closed).");
    }
  }, [
    activeChunk?.id,
    activeChunk?.orderInChapter,
    activeChunk?.pageNumber,
    realtime.state,
    realtime.sendRealtimeText,
  ]);

  const syncKey = useMemo(
    () =>
      `${sessionId}-${chunks.length}-${localChunkIdx}-${activeChunk?.pageNumber ?? 0}`,
    [sessionId, chunks.length, localChunkIdx, activeChunk?.pageNumber],
  );

  useChapterReaderScrollSync({
    leftRef: segmentsScrollRef,
    rightRef: textbookScrollRef,
    enabled:
      Boolean(
        chunks.length &&
        meta?.reader?.chapterId != null &&
        meta.reader.startPage <= meta.reader.endPage,
      ) &&
      !sessionQuery.isPending &&
      !chunksQuery.isPending,
    syncKey,
  });

  useEffect(() => {
    const page = activeChunk?.pageNumber;
    if (page == null || !textbookScrollRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      const root = textbookScrollRef.current;
      if (!root) return;
      const el = root.querySelector<HTMLElement>(
        `[data-reader-page="${page}"][data-reader-anchor="page"]`,
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [localChunkIdx, activeChunk?.pageNumber]);

  useEffect(() => {
    if (!activeChunk?.id || !segmentsScrollRef.current) return;
    const t = window.setTimeout(() => {
      const root = segmentsScrollRef.current;
      if (!root) return;
      const el = root.querySelector<HTMLElement>(
        `[data-chunk-id="${activeChunk.id}"]`,
      );
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [activeChunk?.id]);

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

      <ResizablePanelGroup
        direction={mainSplitDirection}
        autoSaveId={
          session.studentId
            ? `padh-learning-tutor-main-split-${session.studentId}`
            : "padh-learning-tutor-main-split"
        }
        className="flex flex-1 min-h-0"
      >
        <ResizablePanel
          defaultSize={54}
          minSize={mainSplitDirection === "horizontal" ? 30 : 25}
          className="flex min-h-0 min-w-0"
        >
          {/* Center stage — “video” tile for the AI tutor (audio is real; avatar is visual anchor) */}
          <section className="relative flex h-full min-h-[280px] w-full min-w-0 flex-1 flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black px-6 py-8">
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
                  {realtime.state === "connecting" ||
                  getLiveSession.isPending ? (
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
        </ResizablePanel>

        <ResizableHandle
          withHandle
          className="relative z-10 w-2 shrink-0 border-0 bg-zinc-800 data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=horizontal]:w-2 data-[panel-group-direction=horizontal]:cursor-col-resize data-[panel-group-direction=vertical]:cursor-row-resize hover:bg-zinc-600 data-[resize-handle-state=drag]:bg-violet-600/50"
        />

        <ResizablePanel
          defaultSize={46}
          minSize={mainSplitDirection === "horizontal" ? 22 : 28}
          maxSize={mainSplitDirection === "horizontal" ? 68 : 75}
          className="flex min-h-0 min-w-0"
        >
          {/* Right rail — textbook + segments (scroll-synced) */}
          <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-t border-zinc-800 bg-card text-card-foreground lg:border-t-0">
            <div className="flex max-h-[min(50vh,520px)] min-h-[200px] flex-1 flex-col border-b border-border lg:max-h-[55%]">
              <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Textbook
                </span>
              </div>
              <div
                ref={textbookScrollRef}
                className="min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain p-3"
              >
                {meta.reader ? (
                  <ChapterReaderPdfPages
                    chapterId={meta.reader.chapterId}
                    startPage={meta.reader.startPage}
                    endPage={meta.reader.endPage}
                    pdfReaderMode={meta.reader.pdfReaderMode}
                  />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Textbook could not be loaded for this session.
                  </p>
                )}
              </div>
            </div>

            <div className="flex min-h-[180px] flex-1 flex-col max-h-[45vh] lg:max-h-none">
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
                        idx === 0 ||
                        chunks[idx - 1]!.pageNumber !== c.pageNumber;
                      const active = idx === localChunkIdx;
                      return (
                        <li
                          key={c.id}
                          data-chunk-id={c.id}
                          className={cn(
                            "scroll-mt-2 rounded-md pl-1 transition-colors",
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
        </ResizablePanel>
      </ResizablePanelGroup>

      <p className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-3 py-2 text-center text-[11px] text-zinc-500">
        Voice uses Google Gemini Live (AI Studio). Transcript is saved for your
        end-of-session summary.
      </p>
    </div>
  );
}
