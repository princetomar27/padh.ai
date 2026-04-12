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

export const chapterPdfEntrySchema = z.object({
  chapterNumber: z.number().int().min(1).max(200),
  supabaseStorageUrl: z.string().min(1),
  pdfSize: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
});

export const createBookMultiChapterSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional(),
    author: z.string().optional(),
    publisher: z.string().optional(),
    isbn: z.string().optional(),
    subjectId: z.string().min(1),
    classId: z.string().min(1),
    noOfChapters: z.number().int().min(1).max(100),
    chapterPdfs: z.array(chapterPdfEntrySchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (data.chapterPdfs.length !== data.noOfChapters) {
      ctx.addIssue({
        code: "custom",
        message: `Expected ${data.noOfChapters} chapter PDFs, got ${data.chapterPdfs.length}.`,
        path: ["chapterPdfs"],
      });
    }
    const nums = [...data.chapterPdfs]
      .map((c) => c.chapterNumber)
      .sort((a, b) => a - b);
    for (let i = 0; i < data.noOfChapters; i++) {
      if (nums[i] !== i + 1) {
        ctx.addIssue({
          code: "custom",
          message: `Chapter numbers must be exactly 1 … ${data.noOfChapters} with one PDF each.`,
          path: ["chapterPdfs"],
        });
        break;
      }
    }
  });

export const bookIdSchema = z.object({
  bookId: z.string().min(1),
});

export const enqueueBookProcessSchema = bookIdSchema.extend({
  forceReprocess: z.boolean().optional(),
});
