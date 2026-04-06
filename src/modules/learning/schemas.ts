import { z } from "zod";

export const chapterIdInputSchema = z.object({
  chapterId: z.string().min(1),
});

export const sessionIdInputSchema = z.object({
  sessionId: z.string().min(1),
});

export const updateProgressSchema = z.object({
  sessionId: z.string().min(1),
  chunkId: z.string().min(1),
  orderInChapter: z.number().int().min(0),
});

export const appendTranscriptSchema = z.object({
  sessionId: z.string().min(1),
  delta: z.string().max(50_000),
});

export const completeSessionSchema = z.object({
  sessionId: z.string().min(1),
  studentFeedback: z.string().max(5000).optional(),
});
