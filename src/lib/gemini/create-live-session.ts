import "server-only";

import {
  getGeminiLiveModelId,
  getGeminiLiveVoiceName,
  getGoogleAiApiKey,
} from "./env";

const AUTH_TOKENS_URL =
  "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";

export type GeminiLiveSessionCredentials = {
  accessToken: string;
  /** Short id, e.g. gemini-2.5-... */
  model: string;
  /** Resource name for setup, e.g. models/gemini-2.5-... */
  modelResource: string;
  voiceName: string;
  /** First WebSocket JSON payload (includes `setup`). */
  setupMessage: Record<string, unknown>;
  /**
   * Second message to send after `setupComplete` so the model speaks first
   * (welcome + chapter discussion) without waiting for mic input.
   */
  kickoffClientMessage: Record<string, unknown>;
};

async function createEphemeralAuthToken(apiKey: string): Promise<string> {
  const body = {
    expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    uses: 1,
  };

  const res = await fetch(AUTH_TOKENS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const errText = await res.text();
  if (!res.ok) {
    throw new Error(
      `Gemini auth token failed (${res.status}): ${errText.slice(0, 600)}`,
    );
  }

  let data: { name?: string };
  try {
    data = JSON.parse(errText) as { name?: string };
  } catch {
    throw new Error("Gemini auth token: invalid JSON response");
  }

  if (!data.name) {
    throw new Error("Gemini auth token response missing name");
  }
  return data.name;
}

const SESSION_VOICE_RULES = `## Voice session behavior
- The student has just connected to voice. Speak first without waiting.
- Keep replies short by default (3-5 sentences), then pause for interaction.
- Start with a brief intro, ask one short question, then begin chapter teaching.
- Prioritize low-latency turn-taking: avoid long monologues unless asked.
- Keep speech conversational and easy to follow for children.`;

function buildTutorSystemInstruction(
  agentInstructions: string,
  chapterTitle: string,
  bookTitle: string,
): string {
  return `${agentInstructions.trim()}

## Current study session
- Chapter: "${chapterTitle}"
- Book: "${bookTitle}"

${SESSION_VOICE_RULES}`;
}

/** Same shape as `sendRealtimeText` / “Read segment” — reliable for native-audio Live models. */
export function buildKickoffClientMessage(
  chapterTitle: string,
  bookTitle: string,
): Record<string, unknown> {
  const text = `I have just joined the voice session. We are studying the chapter "${chapterTitle}" from "${bookTitle}". Please introduce yourself briefly, ask me one short friendly question about myself or my goals with this subject, then start discussing this chapter with me in a clear, supportive teaching style.`;
  return {
    realtimeInput: { text },
  };
}

/**
 * Creates a short-lived Live API token (v1alpha) via REST (no SDK — avoids Next.js
 * bundling issues with google-auth-library) and the matching `setup` + kickoff
 * messages.
 */
export async function createGeminiLiveSessionForAgent(opts: {
  agentInstructions: string;
  chapterTitle: string;
  bookTitle: string;
}): Promise<GeminiLiveSessionCredentials> {
  const apiKey = getGoogleAiApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing Google AI API key. Set GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY, or put your AI Studio key in GOOGLE_GEMINI_3_FLASH_VISION_MODEL.",
    );
  }

  const modelId = getGeminiLiveModelId();
  const voiceName = getGeminiLiveVoiceName();
  const modelResource = modelId.startsWith("models/")
    ? modelId
    : `models/${modelId}`;

  const systemInstruction = buildTutorSystemInstruction(
    opts.agentInstructions,
    opts.chapterTitle,
    opts.bookTitle,
  );

  const accessToken = await createEphemeralAuthToken(apiKey);

  const setupMessage: Record<string, unknown> = {
    setup: {
      model: modelResource,
      generationConfig: {
        responseModalities: ["AUDIO"],
        temperature: 0.5,
        maxOutputTokens: 140,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
          endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
          silenceDurationMs: 220,
          prefixPaddingMs: 80,
        },
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };

  const kickoffClientMessage = buildKickoffClientMessage(
    opts.chapterTitle,
    opts.bookTitle,
  );

  return {
    accessToken,
    model: modelId.replace(/^models\//, ""),
    modelResource,
    voiceName,
    setupMessage,
    kickoffClientMessage,
  };
}
