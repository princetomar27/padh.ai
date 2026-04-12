import "server-only";

/**
 * OpenAI Realtime currently exposes a fixed set of built-in voices. Older app
 * data may still use legacy TTS names (e.g. nova, fable) — map them so session
 * creation does not fail with a generic "invalid_value" / operation error.
 *
 * @see https://developers.openai.com/api/reference/resources/realtime/subresources/sessions/methods/create
 */
const LEGACY_VOICE_MAP: Record<string, string> = {
  nova: "marin",
  fable: "sage",
  onyx: "cedar",
  alloy: "alloy",
  echo: "echo",
  shimmer: "shimmer",
  ash: "ash",
  ballad: "ballad",
  coral: "coral",
  sage: "sage",
  verse: "verse",
  marin: "marin",
  cedar: "cedar",
};

const ALLOWED = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

export function normalizeOpenAIRealtimeVoice(raw: string): string {
  const v = raw.trim().toLowerCase();
  const mapped = LEGACY_VOICE_MAP[v] ?? v;
  if (ALLOWED.has(mapped)) return mapped;
  return "marin";
}
