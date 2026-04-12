import "server-only";

import { groqChatCompletion, groqConfigured } from "@/lib/groq/chat";
import { getOpenAI } from "./server";

/** LLM JSON may use string, array of bullets, or nested objects — normalize for storage. */
function jsonFieldToTrimmedString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (Array.isArray(v)) {
    return v
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join("\n")
      .trim();
  }
  if (typeof v === "object") {
    return JSON.stringify(v).trim();
  }
  return String(v).trim();
}

export async function summarizeLearningSession(opts: {
  chapterTitle: string;
  bookTitle: string;
  transcript: string | null;
}): Promise<{ summary: string; aiNotes: string }> {
  const raw = (opts.transcript ?? "").trim().slice(0, 120_000);
  const userContent = `Book: ${opts.bookTitle}\nChapter: ${opts.chapterTitle}\n\nSession transcript (may be partial or empty):\n${raw || "(no transcript captured)"}`;

  let text: string;
  if (groqConfigured()) {
    text = await groqChatCompletion({
      responseFormatJson: true,
      messages: [
        {
          role: "system",
          content:
            'Respond with JSON only: {"summary":"2-4 sentences for the student","aiNotes":"markdown bullet list of 3-8 key points to review"}.',
        },
        { role: "user", content: userContent },
      ],
    });
  } else {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_SESSION_SUMMARY_MODEL?.trim() || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Respond with JSON only: {"summary":"2-4 sentences for the student","aiNotes":"markdown bullet list of 3-8 key points to review"}.',
        },
        { role: "user", content: userContent },
      ],
    });
    text = completion.choices[0]?.message?.content ?? "{}";
  }
  let parsed: { summary?: string; aiNotes?: string };
  try {
    parsed = JSON.parse(text) as { summary?: string; aiNotes?: string };
  } catch {
    return {
      summary:
        "Thanks for studying this chapter. Review the textbook pages and try the practice questions.",
      aiNotes: "- Re-read key definitions\n- Work through examples in the book",
    };
  }

  const summary = jsonFieldToTrimmedString(parsed.summary);
  const aiNotes = jsonFieldToTrimmedString(parsed.aiNotes);

  return {
    summary: summary || "Session complete. Keep practicing with your textbook.",
    aiNotes: aiNotes || "- Review the chapter summary in your book",
  };
}
