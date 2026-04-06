import "server-only";

import { normalizeOpenAIRealtimeVoice } from "./realtime-voice";

/**
 * Create a short-lived client secret for browser WebRTC to OpenAI Realtime API.
 *
 * Uses **GA** `POST /v1/realtime/client_secrets` so the token matches
 * `POST /v1/realtime/calls` in the browser (beta `/realtime/sessions` secrets
 * cause `api_version_mismatch`).
 *
 * @see https://platform.openai.com/docs/api-reference/realtime-sessions/create-realtime-client-secret
 */
export async function createRealtimeEphemeralSession(opts: {
  voice: string;
  instructions: string;
}): Promise<{
  clientSecret: string;
  expiresAt: number | null;
  sessionId: string | null;
}> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const model = process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime";

  const voice = normalizeOpenAIRealtimeVoice(opts.voice);

  const ttlSecondsRaw = process.env.OPENAI_REALTIME_CLIENT_SECRET_TTL_SECONDS;
  const ttlSeconds = Math.min(7200, Math.max(10, Number(ttlSecondsRaw) || 900));

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: ttlSeconds,
      },
      session: {
        type: "realtime",
        model,
        instructions: opts.instructions,
        audio: {
          output: {
            voice,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `OpenAI realtime client_secret failed (${res.status}): ${errText.slice(0, 500)}`,
    );
  }

  const data = (await res.json()) as {
    value?: string;
    expires_at?: number;
    session?: { id?: string };
    /** Legacy beta shape — tolerate if API varies */
    client_secret?: { value?: string; expires_at?: number };
  };

  const clientSecret = data.value ?? data.client_secret?.value;
  if (!clientSecret) {
    throw new Error("OpenAI realtime response missing client secret value");
  }

  const expiresAt = data.expires_at ?? data.client_secret?.expires_at ?? null;

  return {
    clientSecret,
    expiresAt,
    sessionId: data.session?.id ?? null,
  };
}
