import "server-only";

function rawVisionEnv(): string | undefined {
  return process.env.GOOGLE_GEMINI_3_FLASH_VISION_MODEL?.trim();
}

/**
 * Google AI Studio / Generative Language API key.
 * Accepts GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY, or a key mistakenly
 * stored in GOOGLE_GEMINI_3_FLASH_VISION_MODEL (values starting with AIza).
 */
export function getGoogleAiApiKey(): string | null {
  const fromDedicated =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim();
  if (fromDedicated) return fromDedicated;
  const vision = rawVisionEnv();
  if (vision?.startsWith("AIza")) return vision;
  return null;
}

/**
 * Vision model id for book PDF chunks. If GOOGLE_GEMINI_3_FLASH_VISION_MODEL
 * holds an API key, falls back to a sensible default model id.
 */
export function getGeminiVisionModelId(): string {
  const v = rawVisionEnv();
  if (!v || v.startsWith("AIza")) return "gemini-2.0-flash";
  return v;
}

export function geminiVisionConfigured(): boolean {
  return Boolean(getGoogleAiApiKey());
}

/** Native-audio / Live model for tutor voice (Google AI Studio). */
export function getGeminiLiveModelId(): string {
  return (
    process.env.GOOGLE_GEMINI_LIVE_MODEL?.trim() ||
    "gemini-2.5-flash-native-audio-preview-09-2025"
  );
}

export function getGeminiLiveVoiceName(): string {
  return process.env.GOOGLE_GEMINI_LIVE_VOICE?.trim() || "Puck";
}
