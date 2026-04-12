/**
 * Inngest background functions for padh.ai.
 *
 * - processBookPdf — single-PDF books or legacy coordinator fan-out
 * - processBookChapterPdf — one Inngest run per chapter PDF (multi-chapter books)
 * - generateImportantQuestions — AI practice questions per chapter
 * - summarizeLearningSessionFn — backfill session summary if sync OpenAI failed
 */

import { generateImportantQuestions } from "./functions/generate-important-questions";
import { processBookChapterPdf } from "./functions/process-book-chapter-pdf";
import { processBookPdf } from "./functions/process-book-pdf";
import { summarizeLearningSessionFn } from "./functions/summarize-learning-session";

export const inngestFunctions = [
  processBookPdf,
  processBookChapterPdf,
  generateImportantQuestions,
  summarizeLearningSessionFn,
];
