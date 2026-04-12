import "server-only";

import {
  geminiVisionConfigured,
  getGeminiVisionModelId,
  getGoogleAiApiKey,
} from "./env";

export { geminiVisionConfigured, getGeminiVisionModelId };

async function fetchImageBase64(
  imageUrl: string,
): Promise<{ mimeType: string; data: string }> {
  const res = await fetch(imageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch page image (${res.status})`);
  }
  const mimeType =
    res.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";
  const buf = Buffer.from(await res.arrayBuffer());
  return { mimeType, data: buf.toString("base64") };
}

async function generateFromImage(opts: {
  system: string;
  userText: string;
  imageUrl: string;
  maxTokens: number;
}): Promise<string> {
  const key = getGoogleAiApiKey();
  if (!key) {
    throw new Error(
      "Google AI API key is not set (GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_API_KEY, or key in GOOGLE_GEMINI_3_FLASH_VISION_MODEL)",
    );
  }
  const model = getGeminiVisionModelId();
  const { mimeType, data } = await fetchImageBase64(opts.imageUrl);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [
        {
          role: "user",
          parts: [
            { text: opts.userText },
            { inline_data: { mime_type: mimeType, data } },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: opts.maxTokens,
        temperature: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Gemini vision failed (${res.status}): ${err.slice(0, 400)}`,
    );
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Gemini returned empty description");
  }
  return text.slice(0, 2000);
}

const EQUATION_SYSTEM = `You are helping an AI voice tutor read an NCERT textbook for Indian school students.
Describe mathematical content in clear, natural spoken English (no LaTeX, no dollar signs, no markdown).
Keep it to at most 4 short sentences. Read operators as words (e.g. "equals", "square root", "integral").`;

const DIAGRAM_SYSTEM = `You are helping an AI voice tutor describe a textbook diagram for a student who is listening (not reading).
Use plain language. Mention labels, axes, arrows, and the main idea being illustrated.
At most 5 short sentences. No markdown.`;

export async function describeEquationChunkWithGemini(input: {
  pageImageUrl: string;
  extractedText: string;
}): Promise<string> {
  const text =
    input.extractedText.trim() ||
    "No reliable text was extracted; infer the math from the page image.";

  return generateFromImage({
    system: EQUATION_SYSTEM,
    userText: `The PDF extractor flagged this passage as mathematical:\n"""${text}"""\nExplain what it means for a student, as if you are speaking aloud.`,
    imageUrl: input.pageImageUrl,
    maxTokens: 450,
  });
}

export async function describeDiagramChunkWithGemini(input: {
  pageImageUrl: string;
  contextHint?: string;
}): Promise<string> {
  const hint = input.contextHint?.trim()
    ? `Context from the page: ${input.contextHint.slice(0, 500)}`
    : "The page may be mostly figures or diagrams.";

  return generateFromImage({
    system: DIAGRAM_SYSTEM,
    userText: `${hint}\nDescribe the main diagram or visual for spoken playback.`,
    imageUrl: input.pageImageUrl,
    maxTokens: 450,
  });
}
