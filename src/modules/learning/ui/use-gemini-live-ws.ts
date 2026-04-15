"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

const WS_BASE = "wss://generativelanguage.googleapis.com";
const INPUT_SAMPLE_RATE = 16000;
/**
 * Smaller chunks reduce user-end -> model-end delay.
 * 1024 @ 48kHz is ~21ms of audio (vs ~85ms at 4096).
 */
const AUDIO_FRAME_SIZE = 1024;

function pcmRateFromMime(mime: string): number {
  const m = /rate=(\d+)/i.exec(mime);
  return m ? parseInt(m[1]!, 10) : 24000;
}

function downsampleBuffer(
  buffer: Float32Array,
  sampleRate: number,
  outSampleRate: number,
): Float32Array {
  if (outSampleRate >= sampleRate) return buffer;
  const ratio = sampleRate / outSampleRate;
  const outLength = Math.floor(buffer.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const src = Math.floor(i * ratio);
    out[i] = buffer[src] ?? 0;
  }
  return out;
}

function floatTo16BitPCM(input: Float32Array): Uint8Array {
  const buf = new ArrayBuffer(input.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function playPcm16Base64(
  ctx: AudioContext,
  base64: string,
  mimeType: string,
  schedule: { nextTime: number },
) {
  const rate = pcmRateFromMime(mimeType);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  } catch {
    return;
  }
  if (bytes.byteLength < 2) return;
  const pcm = new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    Math.floor(bytes.byteLength / 2),
  );
  const float = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    float[i] = pcm[i]! / 32768;
  }
  const buffer = ctx.createBuffer(1, float.length, rate);
  buffer.copyToChannel(float, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  const startAt = Math.max(schedule.nextTime, ctx.currentTime);
  src.start(startAt);
  schedule.nextTime = startAt + buffer.duration;
}

function extractInlineAudio(part: Record<string, unknown>): {
  mimeType: string;
  data: string;
} | null {
  const inline =
    (part.inlineData as Record<string, unknown> | undefined) ??
    (part.inline_data as Record<string, unknown> | undefined);
  if (!inline) return null;
  const data = inline.data;
  const mimeType =
    (inline.mimeType as string | undefined) ??
    (inline.mime_type as string | undefined) ??
    "audio/pcm;rate=24000";
  if (typeof data !== "string") return null;
  const m = mimeType.toLowerCase();
  if (
    m.includes("pcm") ||
    m.includes("l16") ||
    (m.startsWith("audio/") && !m.includes("ogg") && !m.includes("mp3"))
  ) {
    return { mimeType, data };
  }
  return null;
}

function isSetupCompleteMessage(msg: Record<string, unknown>): boolean {
  return (
    Object.prototype.hasOwnProperty.call(msg, "setupComplete") ||
    Object.prototype.hasOwnProperty.call(msg, "setup_complete")
  );
}

/**
 * Browser WebSocket → Gemini Live API (v1alpha) with an ephemeral token from
 * `learning.getGeminiLiveSession`.
 */
export function useGeminiLiveWebSocket(opts: {
  onServerJson?: (raw: string) => void;
}) {
  const { onServerJson } = opts;
  const onServerJsonRef = useRef(onServerJson);
  useEffect(() => {
    onServerJsonRef.current = onServerJson;
  }, [onServerJson]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioInRef = useRef<AudioContext | null>(null);
  const audioOutRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const scheduleRef = useRef({ nextTime: 0 });
  /** Mic uplink to Gemini — off until server is ready; if kickoff is used, stays off until first model turnComplete (reduces speaker→mic echo cutting the opening). */
  const canSendAudioRef = useRef(false);
  /** When true, keep mic frames from being sent until `serverContent.turnComplete`. */
  const deferMicUntilTurnCompleteRef = useRef(false);
  /** Sent once after `setupComplete` so the tutor speaks first (welcome + chapter). */
  const kickoffPendingRef = useRef<Record<string, unknown> | null>(null);
  /**
   * True while the model is generating a turn (after first model output until turnComplete).
   * Sending another `realtimeInput.text` during this window causes overlapping speech.
   */
  const modelTurnActiveRef = useRef(false);
  /** Latest queued `realtimeInput.text` to send when the current model turn ends. */
  const pendingRealtimeTextRef = useRef<string | null>(null);

  const [state, setState] = useState<RealtimeConnectionState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const tryFlushPendingRealtimeText = useCallback(() => {
    const t = pendingRealtimeTextRef.current;
    if (t == null || modelTurnActiveRef.current) return;
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return;
    pendingRealtimeTextRef.current = null;
    w.send(JSON.stringify({ realtimeInput: { text: t } }));
    modelTurnActiveRef.current = true;
  }, []);

  const teardownAudio = useCallback(() => {
    canSendAudioRef.current = false;
    deferMicUntilTurnCompleteRef.current = false;
    modelTurnActiveRef.current = false;
    pendingRealtimeTextRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    void audioInRef.current?.close();
    audioInRef.current = null;
    void audioOutRef.current?.close();
    audioOutRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    scheduleRef.current.nextTime = 0;
  }, []);

  const disconnect = useCallback(() => {
    kickoffPendingRef.current = null;
    modelTurnActiveRef.current = false;
    pendingRealtimeTextRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    teardownAudio();
    setState("idle");
  }, [teardownAudio]);

  const handleMessage = useCallback(
    (data: string) => {
      onServerJsonRef.current?.(data);
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data) as Record<string, unknown>;
      } catch {
        return;
      }

      if (isSetupCompleteMessage(msg)) {
        const kick = kickoffPendingRef.current;
        const w = wsRef.current;
        if (kick && w && w.readyState === WebSocket.OPEN) {
          w.send(JSON.stringify(kick));
          kickoffPendingRef.current = null;
          modelTurnActiveRef.current = true;
        }
        if (!deferMicUntilTurnCompleteRef.current) {
          canSendAudioRef.current = true;
        }
      }

      const outCtx = audioOutRef.current;
      const sc = msg.serverContent as Record<string, unknown> | undefined;

      if (outCtx && sc?.interrupted) {
        scheduleRef.current.nextTime = outCtx.currentTime;
        modelTurnActiveRef.current = false;
        tryFlushPendingRealtimeText();
      }

      const modelTurn = sc?.modelTurn as Record<string, unknown> | undefined;
      const parts = modelTurn?.parts as unknown[] | undefined;

      if (outCtx && parts?.length) {
        modelTurnActiveRef.current = true;
        for (const p of parts) {
          if (!p || typeof p !== "object") continue;
          const audio = extractInlineAudio(p as Record<string, unknown>);
          if (audio) {
            playPcm16Base64(
              outCtx,
              audio.data,
              audio.mimeType,
              scheduleRef.current,
            );
          }
        }
      }

      if (sc && (sc.turnComplete === true || sc.turn_complete === true)) {
        canSendAudioRef.current = true;
        deferMicUntilTurnCompleteRef.current = false;
        modelTurnActiveRef.current = false;
        tryFlushPendingRealtimeText();
      }
    },
    [tryFlushPendingRealtimeText],
  );

  const connect = useCallback(
    async (args: {
      accessToken: string;
      setupMessage: Record<string, unknown>;
      kickoffClientMessage?: Record<string, unknown>;
    }) => {
      disconnect();
      setLastError(null);
      setState("connecting");
      canSendAudioRef.current = false;
      modelTurnActiveRef.current = false;
      pendingRealtimeTextRef.current = null;
      deferMicUntilTurnCompleteRef.current = Boolean(args.kickoffClientMessage);
      kickoffPendingRef.current = args.kickoffClientMessage ?? null;

      let ws: WebSocket | null = null;

      try {
        const token = encodeURIComponent(args.accessToken);
        const url = `${WS_BASE}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        mediaStreamRef.current = stream;

        ws = new WebSocket(url);
        wsRef.current = ws;

        await new Promise<void>((resolve, reject) => {
          const t = window.setTimeout(() => {
            reject(new Error("WebSocket open timeout"));
          }, 25000);
          ws!.onerror = () => {
            window.clearTimeout(t);
            reject(new Error("WebSocket connection failed"));
          };
          ws!.onopen = () => {
            window.clearTimeout(t);
            resolve();
          };
        });

        const outCtx = new AudioContext({ sampleRate: 24000 });
        audioOutRef.current = outCtx;
        await outCtx.resume();

        const routeServerMessage = (raw: string) => {
          handleMessage(raw);
        };

        ws.onmessage = (ev) => {
          void (async () => {
            if (typeof ev.data === "string") {
              routeServerMessage(ev.data);
            } else if (ev.data instanceof Blob) {
              routeServerMessage(await ev.data.text());
            }
          })();
        };

        ws.send(JSON.stringify(args.setupMessage));

        const inCtx = new AudioContext();
        audioInRef.current = inCtx;
        await inCtx.resume();
        const source = inCtx.createMediaStreamSource(stream);
        const processor = inCtx.createScriptProcessor(AUDIO_FRAME_SIZE, 1, 1);
        processorRef.current = processor;
        processor.onaudioprocess = (ev) => {
          const w = wsRef.current;
          if (
            !canSendAudioRef.current ||
            !w ||
            w.readyState !== WebSocket.OPEN
          ) {
            return;
          }
          const input = ev.inputBuffer.getChannelData(0);
          const ctx = audioInRef.current;
          if (!ctx) return;
          const down = downsampleBuffer(
            input,
            ctx.sampleRate,
            INPUT_SAMPLE_RATE,
          );
          const pcm = floatTo16BitPCM(down);
          const b64 = uint8ToBase64(pcm);
          w.send(
            JSON.stringify({
              realtimeInput: {
                audio: {
                  mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
                  data: b64,
                },
              },
            }),
          );
        };
        source.connect(processor);
        processor.connect(inCtx.destination);

        ws.onerror = () => {
          setLastError("Voice connection error");
          setState("error");
        };

        ws.onclose = () => {
          wsRef.current = null;
          teardownAudio();
          setState((prev) => (prev === "error" ? "error" : "idle"));
        };

        setState("connected");
      } catch (e) {
        let msg = e instanceof Error ? e.message : String(e);
        if (
          typeof DOMException !== "undefined" &&
          e instanceof DOMException &&
          e.name === "NotAllowedError"
        ) {
          msg =
            "Microphone access was blocked. Allow the mic for this site, then tap Connect voice again.";
        }
        ws?.close();
        wsRef.current = null;
        teardownAudio();
        setLastError(msg);
        setState("error");
      }
    },
    [disconnect, handleMessage, teardownAudio],
  );

  const sendRealtimeText = useCallback((text: string) => {
    const w = wsRef.current;
    if (!w || w.readyState !== WebSocket.OPEN) return false;
    if (modelTurnActiveRef.current) {
      pendingRealtimeTextRef.current = text;
      return true;
    }
    w.send(JSON.stringify({ realtimeInput: { text } }));
    modelTurnActiveRef.current = true;
    return true;
  }, []);

  return {
    state,
    lastError,
    connect,
    disconnect,
    sendRealtimeText,
  };
}
