import "server-only";

import {
  describeDiagramChunkWithGemini,
  describeEquationChunkWithGemini,
  geminiVisionConfigured,
} from "@/lib/gemini/vision-chunk";
import { getOpenAI, getVisionModel } from "@/lib/openai/server";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";

const EQUATION_SYSTEM = `You are helping an AI voice tutor read an NCERT textbook for Indian school students.
Describe mathematical content in clear, natural spoken English (no LaTeX, no dollar signs, no markdown).
Keep it to at most 4 short sentences. Read operators as words (e.g. "equals", "square root", "integral").`;

const DIAGRAM_SYSTEM = `You are helping an AI voice tutor describe a textbook diagram for a student who is listening (not reading).
Use plain language. Mention labels, axes, arrows, and the main idea being illustrated.
At most 5 short sentences. No markdown.`;

/**
 * Use GPT-4o vision on the full textbook page image to produce TTS-ready narration.
 */
export async function describeEquationChunkWithVision(input: {
  pageImageUrl: string;
  extractedText: string;
}): Promise<string> {
  if (geminiVisionConfigured()) {
    return describeEquationChunkWithGemini(input);
  }

  const openai = getOpenAI();
  const model = getVisionModel();

  const text =
    input.extractedText.trim() ||
    "No reliable text was extracted; infer the math from the page image.";

  const userParts: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `The PDF extractor flagged this passage as mathematical:\n"""${text}"""\nExplain what it means for a student, as if you are speaking aloud.`,
    },
    {
      type: "image_url",
      image_url: { url: input.pageImageUrl, detail: "high" },
    },
  ];

  const res = await openai.chat.completions.create({
    model,
    max_tokens: 450,
    messages: [
      { role: "system", content: EQUATION_SYSTEM },
      { role: "user", content: userParts },
    ],
  });

  const out = res.choices[0]?.message?.content?.trim();
  if (!out) {
    throw new Error("OpenAI returned empty equation description");
  }
  return out.slice(0, 2000);
}

export async function describeDiagramChunkWithVision(input: {
  pageImageUrl: string;
  contextHint?: string;
}): Promise<string> {
  if (geminiVisionConfigured()) {
    return describeDiagramChunkWithGemini(input);
  }

  const openai = getOpenAI();
  const model = getVisionModel();

  const hint = input.contextHint?.trim()
    ? `Context from the page: ${input.contextHint.slice(0, 500)}`
    : "The page may be mostly figures or diagrams.";

  const userParts: ChatCompletionContentPart[] = [
    {
      type: "text",
      text: `${hint}\nDescribe the main diagram or visual for spoken playback.`,
    },
    {
      type: "image_url",
      image_url: { url: input.pageImageUrl, detail: "high" },
    },
  ];

  const res = await openai.chat.completions.create({
    model,
    max_tokens: 450,
    messages: [
      { role: "system", content: DIAGRAM_SYSTEM },
      { role: "user", content: userParts },
    ],
  });

  const out = res.choices[0]?.message?.content?.trim();
  if (!out) {
    throw new Error("OpenAI returned empty diagram description");
  }
  return out.slice(0, 2000);
}
