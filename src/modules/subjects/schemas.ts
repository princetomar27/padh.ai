import { z } from "zod";

export const subjectIdSchema = z.object({
  id: z.string().min(1),
});

export const adminListInputSchema = z.object({
  search: z.string().optional(),
  /** When set, only subjects linked to this class in `class_subjects`. */
  classId: z.string().optional(),
});

export const createSubjectInputSchema = z.object({
  name: z.string().min(1, "Subject name is required"),
  description: z.string().optional(),
  classId: z.string().min(1, "Class is required"),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const updateSubjectInputSchema = createSubjectInputSchema.extend({
  id: z.string().min(1),
});

export const assignBooksInputSchema = z.object({
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  bookIds: z.array(z.string()),
});
