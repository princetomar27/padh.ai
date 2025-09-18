import { z } from "zod";

export const adminDashboardQuerySchema = z.object({
  dateRange: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
  includeAnalytics: z.boolean().default(true),
  includeRecentActivity: z.boolean().default(true),
});

export const recentActivityQuerySchema = z.object({
  limit: z.number().min(1).max(50).default(10),
  type: z
    .enum([
      "book_upload",
      "student_joined",
      "parent_joined",
      "teacher_joined",
      "test_created",
      "ai_tutor_updated",
      "chapter_processed",
      "session_completed",
      "user_registered",
      "content_updated",
    ])
    .optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

export const userAnalyticsQuerySchema = z.object({
  dateRange: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
  role: z.enum(["STUDENT", "PARENT", "TEACHER", "ADMIN"]).optional(),
  class: z.number().min(1).max(12).optional(),
});

export const contentAnalyticsQuerySchema = z.object({
  dateRange: z.enum(["7d", "30d", "90d", "1y"]).default("30d"),
  subjectId: z.string().optional(),
  classId: z.string().optional(),
});

export const systemHealthQuerySchema = z.object({
  includeMetrics: z.boolean().default(true),
  includeBackupInfo: z.boolean().default(true),
});

export const createActivityLogSchema = z.object({
  type: z.enum([
    "book_upload",
    "student_joined",
    "parent_joined",
    "teacher_joined",
    "test_created",
    "ai_tutor_updated",
    "chapter_processed",
    "session_completed",
    "user_registered",
    "content_updated",
  ]),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  actor: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export const bulkUserActionSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
  action: z.enum(["activate", "deactivate", "delete", "export"]),
  reason: z.string().optional(),
});

export const contentModerationSchema = z.object({
  contentId: z.string(),
  contentType: z.enum(["book", "chapter", "test", "question"]),
  action: z.enum(["approve", "reject", "flag", "archive"]),
  reason: z.string().optional(),
  moderatorNotes: z.string().optional(),
});

export type AdminDashboardQuery = z.infer<typeof adminDashboardQuerySchema>;
export type RecentActivityQuery = z.infer<typeof recentActivityQuerySchema>;
export type UserAnalyticsQuery = z.infer<typeof userAnalyticsQuerySchema>;
export type ContentAnalyticsQuery = z.infer<typeof contentAnalyticsQuerySchema>;
export type SystemHealthQuery = z.infer<typeof systemHealthQuerySchema>;
export type CreateActivityLog = z.infer<typeof createActivityLogSchema>;
export type BulkUserAction = z.infer<typeof bulkUserActionSchema>;
export type ContentModeration = z.infer<typeof contentModerationSchema>;
