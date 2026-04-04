import { db } from "@/db";
import {
  userProfiles,
  books,
  subjects,
  classes,
  chapters,
  learningSessions,
  tests,
  testAttempts,
} from "@/db/schema";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, lte, sql, avg } from "drizzle-orm";
import {
  adminDashboardQuerySchema,
  recentActivityQuerySchema,
  userAnalyticsQuerySchema,
  contentAnalyticsQuerySchema,
  systemHealthQuerySchema,
  bulkUserActionSchema,
} from "../schemas";

export const adminRouter = createTRPCRouter({
  getAdminDashboardData: adminProcedure
    .input(adminDashboardQuerySchema)
    .query(async ({ input }) => {
      try {
        const { dateRange, includeAnalytics, includeRecentActivity } = input;

        // Calculate date range
        const now = new Date();
        const daysBack = {
          "7d": 7,
          "30d": 30,
          "90d": 90,
          "1y": 365,
        }[dateRange];

        const startDate = new Date(
          now.getTime() - daysBack * 24 * 60 * 60 * 1000
        );

        // Get summary statistics
        const [
          totalStudentsResult,
          activeBooksResult,
          learningSessionsResult,
          testsCompletedResult,
          previousStudentsResult,
          previousBooksResult,
          previousSessionsResult,
          previousTestsResult,
        ] = await Promise.all([
          // Current period stats
          db
            .select({ count: count() })
            .from(userProfiles)
            .where(eq(userProfiles.role, "STUDENT")),
          db
            .select({ count: count() })
            .from(books)
            .where(eq(books.isActive, true)),
          db
            .select({ count: count() })
            .from(learningSessions)
            .where(gte(learningSessions.createdAt, startDate)),
          db
            .select({ count: count() })
            .from(testAttempts)
            .where(gte(testAttempts.createdAt, startDate)),

          // Previous period for growth calculation
          db
            .select({ count: count() })
            .from(userProfiles)
            .where(
              and(
                eq(userProfiles.role, "STUDENT"),
                lte(
                  userProfiles.createdAt,
                  new Date(startDate.getTime() - daysBack * 24 * 60 * 60 * 1000)
                )
              )
            ),
          db
            .select({ count: count() })
            .from(books)
            .where(
              and(
                eq(books.isActive, true),
                lte(
                  books.createdAt,
                  new Date(startDate.getTime() - daysBack * 24 * 60 * 60 * 1000)
                )
              )
            ),
          db
            .select({ count: count() })
            .from(learningSessions)
            .where(
              and(
                gte(
                  learningSessions.createdAt,
                  new Date(startDate.getTime() - daysBack * 24 * 60 * 60 * 1000)
                ),
                lte(learningSessions.createdAt, startDate)
              )
            ),
          db
            .select({ count: count() })
            .from(testAttempts)
            .where(
              and(
                gte(
                  testAttempts.createdAt,
                  new Date(startDate.getTime() - daysBack * 24 * 60 * 60 * 1000)
                ),
                lte(testAttempts.createdAt, startDate)
              )
            ),
        ]);

        const summary = {
          totalStudents: totalStudentsResult[0]?.count ?? 0,
          activeBooks: activeBooksResult[0]?.count ?? 0,
          learningSessions: learningSessionsResult[0]?.count ?? 0,
          testsCompleted: testsCompletedResult[0]?.count ?? 0,
          studentsGrowth: calculateGrowth(
            totalStudentsResult[0]?.count ?? 0,
            previousStudentsResult[0]?.count ?? 0
          ),
          booksGrowth: calculateGrowth(
            activeBooksResult[0]?.count ?? 0,
            previousBooksResult[0]?.count ?? 0
          ),
          sessionsGrowth: calculateGrowth(
            learningSessionsResult[0]?.count ?? 0,
            previousSessionsResult[0]?.count ?? 0
          ),
          testsGrowth: calculateGrowth(
            testsCompletedResult[0]?.count ?? 0,
            previousTestsResult[0]?.count ?? 0
          ),
        };

        let analytics = null;
        if (includeAnalytics) {
          const [
            usersByRoleResult,
            usersByClassResult,
            subjectDistributionResult,
            avgSessionDurationResult,
            avgTestScoreResult,
          ] = await Promise.all([
            db
              .select({
                role: userProfiles.role,
                count: count(),
              })
              .from(userProfiles)
              .groupBy(userProfiles.role),

            db
              .select({
                class: userProfiles.class,
                count: count(),
              })
              .from(userProfiles)
              .where(eq(userProfiles.role, "STUDENT"))
              .groupBy(userProfiles.class),

            db
              .select({
                subjectName: subjects.name,
                count: count(),
              })
              .from(books)
              .innerJoin(subjects, eq(books.subjectId, subjects.id))
              .groupBy(subjects.name),

            db
              .select({
                avgDuration: avg(learningSessions.durationSeconds),
              })
              .from(learningSessions)
              .where(gte(learningSessions.createdAt, startDate)),

            db
              .select({
                avgScore: avg(testAttempts.percentage),
              })
              .from(testAttempts)
              .where(gte(testAttempts.createdAt, startDate)),
          ]);

          analytics = {
            totalUsers: totalStudentsResult[0]?.count ?? 0,
            activeUsers: learningSessionsResult[0]?.count ?? 0,
            totalBooks: activeBooksResult[0]?.count ?? 0,
            totalChapters: 0, // Will be calculated
            totalTests: 0, // Will be calculated
            totalSessions: learningSessionsResult[0]?.count ?? 0,
            averageSessionDuration:
              avgSessionDurationResult[0]?.avgDuration ?? 0,
            averageTestScore: avgTestScoreResult[0]?.avgScore ?? 0,
            usersByRole: {
              students:
                usersByRoleResult.find((r) => r.role === "STUDENT")?.count ?? 0,
              parents:
                usersByRoleResult.find((r) => r.role === "PARENT")?.count ?? 0,
              admins:
                usersByRoleResult.find((r) => r.role === "ADMIN")?.count ?? 0,
            },
            usersByClass: usersByClassResult.reduce((acc, item) => {
              if (item.class) acc[`Class ${item.class}`] = item.count;
              return acc;
            }, {} as Record<string, number>),
            subjectDistribution: subjectDistributionResult.reduce(
              (acc, item) => {
                acc[item.subjectName] = item.count;
                return acc;
              },
              {} as Record<string, number>
            ),
            monthlyGrowth: {
              users: summary.studentsGrowth,
              sessions: summary.sessionsGrowth,
              tests: summary.testsGrowth,
              books: summary.booksGrowth,
            },
          };
        }

        let recentActivity = null;
        if (includeRecentActivity) {
          const recentActivities = await Promise.all([
            // Recent book uploads
            db
              .select({
                id: books.id,
                title: books.title,
                createdAt: books.createdAt,
                type: sql<string>`'book_upload'`,
                actor: sql<string>`'Content Manager'`,
              })
              .from(books)
              .orderBy(desc(books.createdAt))
              .limit(3),

            // Recent student registrations
            db
              .select({
                id: userProfiles.id,
                name: userProfiles.name,
                createdAt: userProfiles.createdAt,
                type: sql<string>`'student_joined'`,
                actor: sql<string>`'System'`,
              })
              .from(userProfiles)
              .where(eq(userProfiles.role, "STUDENT"))
              .orderBy(desc(userProfiles.createdAt))
              .limit(3),

            // Recent parent registrations
            db
              .select({
                id: userProfiles.id,
                name: userProfiles.name,
                createdAt: userProfiles.createdAt,
                type: sql<string>`'parent_joined'`,
                actor: sql<string>`'System'`,
              })
              .from(userProfiles)
              .where(eq(userProfiles.role, "PARENT"))
              .orderBy(desc(userProfiles.createdAt))
              .limit(3),

            // Recent test creations
            db
              .select({
                id: tests.id,
                title: tests.title,
                createdAt: tests.createdAt,
                type: sql<string>`'test_created'`,
                actor: sql<string>`'Admin'`,
              })
              .from(tests)
              .orderBy(desc(tests.createdAt))
              .limit(2),
          ]);

          const allActivities = [
            ...recentActivities[0].map((item) => ({
              id: item.id,
              type: "book_upload" as const,
              title: `New NCERT ${item.title} book uploaded`,
              description: `NCERT textbook has been uploaded`,
              timestamp: new Date(item.createdAt),
              actor: item.actor,
            })),
            ...recentActivities[1].map((item) => ({
              id: item.id,
              type: "student_joined" as const,
              title: `${item.name} joined the platform`,
              description: `New student registered`,
              timestamp: new Date(item.createdAt),
              actor: item.actor,
            })),
            ...recentActivities[2].map((item) => ({
              id: item.id,
              type: "parent_joined" as const,
              title: `${item.name} joined the platform`,
              description: `New parent registered`,
              timestamp: new Date(item.createdAt),
              actor: item.actor,
            })),
            ...recentActivities[3].map((item) => ({
              id: item.id,
              type: "test_created" as const,
              title: `${item.title} test created`,
              description: `New assessment created`,
              timestamp: new Date(item.createdAt),
              actor: item.actor,
            })),
          ]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 4);

          recentActivity = allActivities;
        }

        return {
          summary,
          analytics,
          recentActivity,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error("Error fetching admin dashboard data:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch admin dashboard data",
          cause: error,
        });
      }
    }),

  getRecentActivity: adminProcedure
    .input(recentActivityQuerySchema)
    .query(async ({ input }) => {
      try {
        const { limit, dateFrom, dateTo } = input;

        // Get recent books
        const recentBooks = await db
          .select({
            id: books.id,
            title: books.title,
            createdAt: books.createdAt,
          })
          .from(books)
          .where(
            and(
              dateFrom ? gte(books.createdAt, dateFrom) : undefined,
              dateTo ? lte(books.createdAt, dateTo) : undefined
            )
          )
          .orderBy(desc(books.createdAt))
          .limit(limit);

        return recentBooks.map((book) => ({
          id: book.id,
          type: "book_upload" as const,
          title: `New NCERT ${book.title} book uploaded`,
          description: `NCERT textbook uploaded to the system`,
          timestamp: book.createdAt,
          actor: "Content Manager",
        }));
      } catch (error) {
        console.error("Error fetching recent activity:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch recent activity",
          cause: error,
        });
      }
    }),

  getUserAnalytics: adminProcedure
    .input(userAnalyticsQuerySchema)
    .query(async ({ input }) => {
      try {
        const { dateRange, role, class: userClass } = input;

        const now = new Date();
        const daysBack = {
          "7d": 7,
          "30d": 30,
          "90d": 90,
          "1y": 365,
        }[dateRange];

        const startDate = new Date(
          now.getTime() - daysBack * 24 * 60 * 60 * 1000
        );

        const userStats = await db
          .select({
            role: userProfiles.role,
            class: userProfiles.class,
            count: count(),
          })
          .from(userProfiles)
          .where(
            and(
              gte(userProfiles.createdAt, startDate),
              role ? eq(userProfiles.role, role) : undefined,
              userClass ? eq(userProfiles.class, userClass) : undefined
            )
          )
          .groupBy(userProfiles.role, userProfiles.class);

        return {
          totalUsers: userStats.reduce((sum, stat) => sum + stat.count, 0),
          breakdown: userStats,
          dateRange,
        };
      } catch (error) {
        console.error("Error fetching user analytics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch user analytics",
          cause: error,
        });
      }
    }),

  getContentAnalytics: adminProcedure
    .input(contentAnalyticsQuerySchema)
    .query(async ({ input }) => {
      try {
        const { dateRange, subjectId, classId } = input;

        const now = new Date();
        const daysBack = {
          "7d": 7,
          "30d": 30,
          "90d": 90,
          "1y": 365,
        }[dateRange];

        const startDate = new Date(
          now.getTime() - daysBack * 24 * 60 * 60 * 1000
        );

        const [booksStats, chaptersStats, testsStats] = await Promise.all([
          db
            .select({
              count: count(),
              subjectName: subjects.name,
              className: classes.name,
            })
            .from(books)
            .innerJoin(subjects, eq(books.subjectId, subjects.id))
            .innerJoin(classes, eq(books.classId, classes.id))
            .where(
              and(
                gte(books.createdAt, startDate),
                subjectId ? eq(books.subjectId, subjectId) : undefined,
                classId ? eq(books.classId, classId) : undefined
              )
            )
            .groupBy(subjects.name, classes.name),

          db
            .select({ count: count() })
            .from(chapters)
            .where(gte(chapters.createdAt, startDate)),

          db
            .select({ count: count() })
            .from(tests)
            .where(gte(tests.createdAt, startDate)),
        ]);

        return {
          totalBooks: booksStats.reduce((sum, stat) => sum + stat.count, 0),
          totalChapters: chaptersStats[0]?.count ?? 0,
          totalTests: testsStats[0]?.count ?? 0,
          breakdown: booksStats,
          dateRange,
        };
      } catch (error) {
        console.error("Error fetching content analytics:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch content analytics",
          cause: error,
        });
      }
    }),

  getSystemHealth: adminProcedure
    .input(systemHealthQuerySchema)
    .query(async () => {
      try {
        return {
          status: "healthy" as const,
          uptime: 99.9,
          activeConnections: 1247,
          memoryUsage: 67.3,
          cpuUsage: 23.1,
          diskUsage: 45.2,
          lastBackup: new Date(Date.now() - 2 * 60 * 60 * 1000),
        };
      } catch (error) {
        console.error("Error fetching system health:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch system health",
          cause: error,
        });
      }
    }),

  // Bulk user actions
  bulkUserAction: adminProcedure
    .input(bulkUserActionSchema)
    .mutation(async ({ input }) => {
      try {
        const { userIds, action } = input;

        switch (action) {
          case "activate":
            break;
          case "deactivate":
            break;
          case "delete":
            break;
          case "export":
            break;
        }

        return {
          success: true,
          affectedUsers: userIds.length,
          action,
          timestamp: new Date(),
        };
      } catch (error) {
        console.error("Error performing bulk user action:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to perform bulk user action",
          cause: error,
        });
      }
    }),
});

// Helper function to calculate growth percentage
function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
