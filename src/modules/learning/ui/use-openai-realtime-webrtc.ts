"use client";

import { useCallback, useRef, useState } from "react";

export type RealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

type ConnectArgs = {
  clientSecret: string;
};

/**
 * Browser WebRTC → OpenAI Realtime (`/v1/realtime/calls`) using an ephemeral
 * client secret from `learning.getRealtimeEphemeral` (legacy; tutor uses Gemini Live).
 *
 * @see https://platform.openai.com/docs/guides/realtime-webrtc
 */
export function useOpenAIRealtimeWebRTC(opts: {
  onDataMessage?: (raw: string) => void;
}) {
  const { onDataMessage } = opts;
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<RealtimeConnectionState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);

  const disconnect = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.getSenders().forEach((s) => {
      if (s.track) s.track.stop();
    });
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState("idle");
  }, []);

  const connect = useCallback(
    async ({ clientSecret }: ConnectArgs) => {
      disconnect();
      setLastError(null);
      setState("connecting");

      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        pcRef.current = pc;

        const remoteAudio = document.createElement("audio");
        remoteAudio.autoplay = true;
        remoteAudio.setAttribute("playsinline", "true");
        pc.ontrack = (ev) => {
          remoteAudio.srcObject = ev.streams[0];
        };

        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = ms;
        ms.getTracks().forEach((track) => pc.addTrack(track, ms));

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (ev) => {
          if (typeof ev.data === "string") {
            onDataMessage?.(ev.data);
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpResponse = await fetch(
          "https://api.openai.com/v1/realtime/calls",
          {
            method: "POST",
            body: offer.sdp ?? "",
            headers: {
              Authorization: `Bearer ${clientSecret}`,
              "Content-Type": "application/sdp",
            },
          },
        );

        if (!sdpResponse.ok) {
          const errText = await sdpResponse.text();
          throw new Error(
            `Realtime SDP exchange failed (${sdpResponse.status}): ${errText.slice(0, 400)}`,
          );
        }

        const answerSdp = await sdpResponse.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        setState("connected");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setLastError(msg);
        setState("error");
        disconnect();
      }
    },
    [disconnect, onDataMessage],
  );

  const sendClientEvent = useCallback((payload: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") {
      return false;
    }
    dc.send(JSON.stringify(payload));
    return true;
  }, []);

  return {
    state,
    lastError,
    connect,
    disconnect,
    sendClientEvent,
  };
}
