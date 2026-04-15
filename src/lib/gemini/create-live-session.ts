import "server-only";

import {
  getGeminiLiveModelId,
  getGeminiLiveVoiceName,
  getGoogleAiApiKey,
} from "./env";

const AUTH_TOKENS_URL =
  "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";

/** Max chars for kickoff `realtimeInput.text` (keeps WS payload reasonable). */
const KICKOFF_TEXT_BUDGET = 3200;

export type GeminiLiveLessonQuestion = {
  questionText: string;
  difficulty?: string | null;
};

export type GeminiLiveLessonContext = {
  chapterTitle: string;
  bookTitle: string;
  chapterNumber: number | null;
  chapterPdfStartPage: number;
  chapterPdfEndPage: number;
  description: string | null;
  objectives: string | null;
  importantQuestions: GeminiLiveLessonQuestion[];
  /** `pdfChunks.orderInChapter` (0-based index in chapter). */
  currentOrderInChapter: number;
  /** Student-facing segment number (matches UI “Seg N”). */
  currentSegmentDisplayOneBased: number;
  currentPdfPage: number;
  currentSegmentPreview: string;
};

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

function clip(s: string | null | undefined, max: number): string {
  if (!s) return "";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function buildLessonVoiceRules(ctx: GeminiLiveLessonContext): string {
  const iqLines =
    ctx.importantQuestions.length > 0
      ? ctx.importantQuestions
          .map(
            (q, i) =>
              `${i + 1}. ${clip(q.questionText, 220)}${q.difficulty ? ` (${q.difficulty})` : ""}`,
          )
          .join("\n")
      : "(No generated important-questions list yet — still weave in good exam-style checks.)";

  const desc = clip(ctx.description, 900);
  const obj = clip(ctx.objectives, 1100);

  return `## Voice lesson behavior (live class)
- The student just joined voice. **Speak first** with a warm, energetic welcome — like a great teacher starting class.
- They see the **textbook PDF** on screen for this chapter (book pages **${ctx.chapterPdfStartPage}–${ctx.chapterPdfEndPage}**). Reference the visible page when it helps.
- **Teach in order**: follow textbook segments in orderInChapter (global order through the chapter). One segment (or one PDF page worth of ideas) at a time: explain clearly → **one quick check question** → invite their questions → then offer to move on.
- **Start where they are**: they are currently on **segment ${ctx.currentSegmentDisplayOneBased}** (internal order index ${ctx.currentOrderInChapter}; PDF page **${ctx.currentPdfPage}**). Open with a hook tied to this spot, then teach this part before advancing.
- Use **short–medium turns** (roughly 4–8 sentences) so it feels conversational, unless they ask to go deeper.
- Encourage them to use **“Read segment”** if a dense paragraph needs exact wording.
- Stay supportive, age-appropriate, and celebrate small wins.

## Chapter context (use naturally in dialogue)
**Chapter:** "${ctx.chapterTitle}" (book chapter #${ctx.chapterNumber ?? "?"})  
**Book:** "${ctx.bookTitle}"

**Description:**  
${desc || "(none)"}

**Learning objectives:**  
${obj || "(none)"}

**Important questions to weave in over the lesson (not all at once):**  
${iqLines}

**Current segment preview (for grounding only — expand and teach, don’t only read):**  
"""${clip(ctx.currentSegmentPreview, 700)}"""`;
}

function buildTutorSystemInstruction(
  agentInstructions: string,
  ctx: GeminiLiveLessonContext,
): string {
  return `${agentInstructions.trim()}

${buildLessonVoiceRules(ctx)}`;
}

/** Same shape as sendRealtimeText / “Read segment” — reliable for native-audio Live models. */
export function buildKickoffClientMessage(
  ctx: GeminiLiveLessonContext,
): Record<string, unknown> {
  const parts: string[] = [
    `I just joined the live voice lesson.`,
    `We're on chapter "${ctx.chapterTitle}" from "${ctx.bookTitle}".`,
    `I'm looking at the textbook PDF (pages ${ctx.chapterPdfStartPage}–${ctx.chapterPdfEndPage}).`,
    `Please start class now: energetic greeting, one friendly question about my goals, then begin teaching **right at** segment ${ctx.currentSegmentDisplayOneBased} (PDF page ${ctx.currentPdfPage}).`,
    `Work page-by-page / segment-by-segment in order; after each chunk, check my understanding before moving on.`,
  ];
  let text = parts.join(" ");
  if (text.length > KICKOFF_TEXT_BUDGET) {
    text = clip(text, KICKOFF_TEXT_BUDGET);
  }
  return {
    realtimeInput: { text },
  };
}

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

/**
 * Creates a short-lived Live API token (v1alpha) via REST (no SDK — avoids Next.js
 * bundling issues with google-auth-library) and the matching `setup` + kickoff
 * messages.
 */
export async function createGeminiLiveSessionForAgent(opts: {
  agentInstructions: string;
  lesson: GeminiLiveLessonContext;
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
    opts.lesson,
  );

  const accessToken = await createEphemeralAuthToken(apiKey);

  const setupMessage: Record<string, unknown> = {
    setup: {
      model: modelResource,
      generationConfig: {
        responseModalities: ["AUDIO"],
        temperature: 0.55,
        // Native audio needs room for full sentences; 140 caused abrupt cutoffs.
        maxOutputTokens: 8192,
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: "START_SENSITIVITY_LOW",
          endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
          silenceDurationMs: 700,
          prefixPaddingMs: 220,
        },
      },
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    },
  };

  const kickoffClientMessage = buildKickoffClientMessage(opts.lesson);

  return {
    accessToken,
    model: modelId.replace(/^models\//, ""),
    modelResource,
    voiceName,
    setupMessage,
    kickoffClientMessage,
  };
}
