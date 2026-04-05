/**
 * Inngest background functions for padh.ai.
 *
 * - processBookPdf — NCERT-style PDF → book_pages, chapters, pdf_chunks
 * - (future) generateQuestions — GPT-4o question generation per chapter
 */

import { processBookPdf } from "./functions/process-book-pdf";

export const inngestFunctions = [processBookPdf];
