import { z } from "zod";
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MIN_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "@/constants";

export const classesInsertSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Class name is required" })
    .max(50, { message: "Class name too long" }),
  number: z
    .number()
    .min(1, { message: "Class number must be at least 1" })
    .max(12, { message: "Class number cannot exceed 12" }),
  isActive: z.boolean().default(true).optional(),
  description: z.string().optional(),
});

export const classesUpdateSchema = z.object({
  id: z.string(),
  name: z
    .string()
    .min(1, { message: "Class name is required" })
    .max(50, { message: "Class name too long" })
    .optional(),
  number: z
    .number()
    .min(1, { message: "Class number must be at least 1" })
    .max(12, { message: "Class number cannot exceed 12" })
    .optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const classesQuerySchema = z.object({
  page: z.number().min(1).default(DEFAULT_PAGE),
  pageSize: z
    .number()
    .min(MIN_PAGE_SIZE)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
  classNumber: z.number().min(1).max(12).nullable().optional(),
  isActive: z.boolean().nullable().optional(),
});

export const classIdSchema = z.object({
  id: z.string().min(1, "Class ID is required"),
});

export type ClassesInsert = z.infer<typeof classesInsertSchema>;
export type ClassesUpdate = z.infer<typeof classesUpdateSchema>;
export type ClassesQuery = z.infer<typeof classesQuerySchema>;
export type ClassId = z.infer<typeof classIdSchema>;
