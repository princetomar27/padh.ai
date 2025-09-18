import { inferRouterOutputs } from "@trpc/server";
import { AppRouter } from "@/trpc/routers/_app";

export type AdminDashboardData =
  inferRouterOutputs<AppRouter>["admin"]["getAdminDashboardData"];

export interface AdminDashboardSummary {
  totalStudents: number;
  activeBooks: number;
  learningSessions: number;
  testsCompleted: number;
  studentsGrowth: number;
  booksGrowth: number;
  sessionsGrowth: number;
  testsGrowth: number;
}

export interface RecentActivityItem {
  id: string;
  type:
    | "book_upload"
    | "student_joined"
    | "parent_joined"
    | "teacher_joined"
    | "test_created"
    | "ai_tutor_updated"
    | "chapter_processed";
  title: string;
  description: string;
  timestamp: Date;
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface QuickActionItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  href?: string;
  onClick?: () => void;
  variant: "primary" | "secondary" | "success" | "warning";
}

export interface AdminAnalytics {
  totalUsers: number;
  activeUsers: number;
  totalBooks: number;
  totalChapters: number;
  totalTests: number;
  totalSessions: number;
  averageSessionDuration: number;
  averageTestScore: number;
  usersByRole: {
    students: number;
    teachers: number;
    parents: number;
    admins: number;
  };
  usersByClass: Record<string, number>;
  subjectDistribution: Record<string, number>;
  monthlyGrowth: {
    users: number;
    sessions: number;
    tests: number;
    books: number;
  };
}

export interface SystemHealth {
  status: "healthy" | "warning" | "critical";
  uptime: number;
  activeConnections: number;
  memoryUsage: number;
  cpuUsage: number;
  diskUsage: number;
  lastBackup: Date;
}

export enum ActivityType {
  BOOK_UPLOAD = "book_upload",
  STUDENT_JOINED = "student_joined",
  PARENT_JOINED = "parent_joined",
  TEACHER_JOINED = "teacher_joined",
  TEST_CREATED = "test_created",
  AI_TUTOR_UPDATED = "ai_tutor_updated",
  CHAPTER_PROCESSED = "chapter_processed",
  SESSION_COMPLETED = "session_completed",
  USER_REGISTERED = "user_registered",
  CONTENT_UPDATED = "content_updated",
}

export enum UserRole {
  STUDENT = "STUDENT",
  PARENT = "PARENT",
  TEACHER = "TEACHER",
  ADMIN = "ADMIN",
}

export enum MetricType {
  DAILY_ACTIVE_USERS = "daily_active_users",
  SESSION_DURATION = "session_duration",
  TEST_COMPLETION_RATE = "test_completion_rate",
  CONTENT_ENGAGEMENT = "content_engagement",
  USER_RETENTION = "user_retention",
}
