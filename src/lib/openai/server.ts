import "server-only";

import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

/** OpenAI chat vision model (used when Gemini vision is not configured). */
export function getVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o";
}
