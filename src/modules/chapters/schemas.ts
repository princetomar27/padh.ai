import { z } from "zod";

export const chapterIdInputSchema = z.object({
  id: z.string().min(1),
});

export const updateChapterInputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10_000).nullable().optional(),
  objectives: z.string().max(20_000).nullable().optional(),
  duration: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

export const readerChunksInputSchema = z.object({
  chapterId: z.string().min(1),
  afterOrder: z.number().int().min(-1).default(-1),
  limit: z.number().int().min(1).max(150).default(80),
});
