import { z } from "zod";

export const createBookSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  publisher: z.string().optional(),
  isbn: z.string().optional(),
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  /** Public URL or Supabase bucket-relative path to the original PDF. */
  supabaseStorageUrl: z.string().min(1),
  pdfSize: z.number().int().nonnegative().optional(),
});

export const bookIdSchema = z.object({
  bookId: z.string().min(1),
});

export const enqueueBookProcessSchema = bookIdSchema.extend({
  forceReprocess: z.boolean().optional(),
});
