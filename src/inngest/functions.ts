/**
 * Inngest background functions for padh.ai.
 *
 * - processBookPdf — NCERT-style PDF → book_pages, chapters, pdf_chunks
 * - generateImportantQuestions — AI practice questions per chapter
 * - summarizeLearningSessionFn — backfill session summary if sync OpenAI failed
 */

import { generateImportantQuestions } from "./functions/generate-important-questions";
import { processBookPdf } from "./functions/process-book-pdf";
import { summarizeLearningSessionFn } from "./functions/summarize-learning-session";

export const inngestFunctions = [
  processBookPdf,
  generateImportantQuestions,
  summarizeLearningSessionFn,
];
