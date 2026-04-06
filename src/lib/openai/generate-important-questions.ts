import "server-only";

import { groqChatCompletion, groqConfigured } from "@/lib/groq/chat";
import { getOpenAI } from "./server";

export type GeneratedImportantQuestion = {
  questionText: string;
  questionType: "MCQ" | "SHORT_ANSWER";
  options?: string[];
  correctIndex?: number;
  correctAnswer: string;
  explanation?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
};

/**
 * Produce a small set of practice questions from chapter chunk text (NCERT-style).
 */
export async function generateImportantQuestionsFromChapterText(opts: {
  chapterTitle: string;
  bookTitle: string;
  chunkExcerpt: string;
}): Promise<GeneratedImportantQuestion[]> {
  const excerpt = opts.chunkExcerpt.trim().slice(0, 100_000);
  const userContent = `Book: ${opts.bookTitle}\nChapter: ${opts.chapterTitle}\n\nChapter text (excerpt):\n${excerpt || "(empty)"}`;
  const system = `You create study questions for Indian NCERT students. Output JSON only:
{"questions":[
  {
    "questionText": string,
    "questionType": "MCQ" | "SHORT_ANSWER",
    "options": string[] (4 items, only for MCQ),
    "correctIndex": number (0-3, only for MCQ),
    "correctAnswer": string (for MCQ: copy the correct option text exactly; for SHORT_ANSWER: a concise model answer),
    "explanation": string (1-3 sentences),
    "difficulty": "EASY" | "MEDIUM" | "HARD"
  }
]}
Rules: 6–10 questions. At least 3 MCQ and 2 SHORT_ANSWER. Ground every question in the provided chapter text; do not invent facts not supported by the excerpt.`;

  let text: string;
  if (groqConfigured()) {
    text = await groqChatCompletion({
      responseFormatJson: true,
      maxTokens: 4096,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    });
  } else {
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model:
        process.env.OPENAI_IMPORTANT_QUESTIONS_MODEL?.trim() || "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    });
    text = completion.choices[0]?.message?.content ?? "{}";
  }
  let parsed: { questions?: GeneratedImportantQuestion[] };
  try {
    parsed = JSON.parse(text) as { questions?: GeneratedImportantQuestion[] };
  } catch {
    return [];
  }

  const qs = parsed.questions ?? [];
  return qs.filter(
    (q) =>
      q &&
      typeof q.questionText === "string" &&
      (q.questionType === "MCQ" || q.questionType === "SHORT_ANSWER") &&
      typeof q.correctAnswer === "string",
  );
}
