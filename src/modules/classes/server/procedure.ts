import { db } from "@/db";
import { classes, subjects, books, userProfiles, chapters } from "@/db/schema";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, getTableColumns, ilike, sql } from "drizzle-orm";
import {
  classesInsertSchema,
  classesUpdateSchema,
  classesQuerySchema,
  classIdSchema,
} from "../schemas";
import { getClassDescription } from "../types";

export const classesRouter = createTRPCRouter({
  // Get many classes with stats
  getMany: protectedProcedure
    .input(classesQuerySchema)
    .query(async ({ input }) => {
      try {
        const { search, page, pageSize, classNumber, isActive } = input;

        // Get basic classes data first
        const data = await db
          .select(getTableColumns(classes))
          .from(classes)
          .where(
            and(
              search ? ilike(classes.name, `%${search}%`) : undefined,
              classNumber ? eq(classes.number, classNumber) : undefined,
              isActive !== undefined && isActive !== null
                ? eq(classes.isActive, isActive)
                : undefined
            )
          )
          .orderBy(desc(classes.number))
          .limit(pageSize)
          .offset((page - 1) * pageSize);

        // Get counts for each class
        const itemsWithStats = await Promise.all(
          data.map(async (classItem) => {
            const [studentCount, subjectCount, bookCount] = await Promise.all([
              db
                .select({ count: count() })
                .from(userProfiles)
                .where(
                  and(
                    eq(userProfiles.class, classItem.number),
                    eq(userProfiles.role, "STUDENT")
                  )
                ),

              db
                .select({ count: count() })
                .from(books)
                .innerJoin(subjects, eq(books.subjectId, subjects.id))
                .where(
                  and(eq(books.classId, classItem.id), eq(books.isActive, true))
                ),

              db
                .select({ count: count() })
                .from(books)
                .where(
                  and(eq(books.classId, classItem.id), eq(books.isActive, true))
                ),
            ]);

            return {
              ...classItem,
              studentCount: studentCount[0]?.count ?? 0,
              subjectCount: subjectCount[0]?.count ?? 0,
              bookCount: bookCount[0]?.count ?? 0,
            };
          })
        );

        // Get total count for pagination
        const [total] = await db
          .select({ count: count() })
          .from(classes)
          .where(
            and(
              search ? ilike(classes.name, `%${search}%`) : undefined,
              classNumber ? eq(classes.number, classNumber) : undefined,
              isActive !== undefined && isActive !== null
                ? eq(classes.isActive, isActive)
                : undefined
            )
          );

        const totalPages = Math.ceil(total.count / pageSize);

        // Add computed description to each class
        const itemsWithDescription = itemsWithStats.map((item) => ({
          ...item,
          description: item.description || getClassDescription(item.number),
        }));

        return {
          items: itemsWithDescription,
          total: total.count,
          totalPages,
        };
      } catch (error) {
        console.error("Error fetching classes:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch classes",
          cause: error,
        });
      }
    }),

  // Get single class with detailed stats
  getOne: protectedProcedure.input(classIdSchema).query(async ({ input }) => {
    try {
      const [classData] = await db
        .select(getTableColumns(classes))
        .from(classes)
        .where(eq(classes.id, input.id));

      if (!classData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Class not found",
        });
      }

      // Get counts separately to avoid SQL complexity
      const [studentCount, subjectCount, bookCount, chapterCount] =
        await Promise.all([
          db
            .select({ count: count() })
            .from(userProfiles)
            .where(
              and(eq(userProfiles.class, classData.number), eq(userProfiles.role, "STUDENT"))
            ),

          db
            .select({ count: count() })
            .from(books)
            .innerJoin(subjects, eq(books.subjectId, subjects.id))
            .where(
              and(eq(books.classId, classData.id), eq(books.isActive, true))
            ),

          db
            .select({ count: count() })
            .from(books)
            .where(
              and(eq(books.classId, classData.id), eq(books.isActive, true))
            ),

          db
            .select({ count: count() })
            .from(chapters)
            .where(
              and(
                eq(chapters.classId, classData.id),
                eq(chapters.isActive, true)
              )
            ),
        ]);

      return {
        ...classData,
        studentCount: studentCount[0]?.count ?? 0,
        subjectCount: subjectCount[0]?.count ?? 0,
        bookCount: bookCount[0]?.count ?? 0,
        chapterCount: chapterCount[0]?.count ?? 0,
        description:
          classData.description || getClassDescription(classData.number),
      };
    } catch (error) {
      console.error("Error fetching class:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch class",
        cause: error,
      });
    }
  }),

  // Create new class (admin only)
  createClass: adminProcedure
    .input(classesInsertSchema)
    .mutation(async ({ input }) => {
      try {
        // Check if class number already exists
        const [existingClass] = await db
          .select()
          .from(classes)
          .where(eq(classes.number, input.number));

        if (existingClass) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Class ${input.number} already exists`,
          });
        }

        const [createdClass] = await db
          .insert(classes)
          .values({
            ...input,
            description: input.description || getClassDescription(input.number),
          })
          .returning();

        if (!createdClass) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create class",
          });
        }

        return createdClass;
      } catch (error) {
        console.error("Error creating class:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create class",
          cause: error,
        });
      }
    }),

  // Update class (admin only)
  updateClass: adminProcedure
    .input(classesUpdateSchema)
    .mutation(async ({ input }) => {
      try {
        const { id, ...updateData } = input;

        // If updating class number, check for conflicts
        if (updateData.number) {
          const [existingClass] = await db
            .select()
            .from(classes)
            .where(
              and(
                eq(classes.number, updateData.number),
                // Exclude current class from conflict check
                sql`${classes.id} != ${id}`
              )
            );

          if (existingClass) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `Class ${updateData.number} already exists`,
            });
          }
        }

        const [updatedClass] = await db
          .update(classes)
          .set({
            ...updateData,
            updatedAt: new Date(),
          })
          .where(eq(classes.id, id))
          .returning();

        if (!updatedClass) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Class not found",
          });
        }

        return updatedClass;
      } catch (error) {
        console.error("Error updating class:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update class",
          cause: error,
        });
      }
    }),

  // Delete class (admin only)
  removeClass: adminProcedure
    .input(classIdSchema)
    .mutation(async ({ input }) => {
      try {
        // Check if class has students
        const [studentCount] = await db
          .select({ count: count() })
          .from(userProfiles)
          .where(
            and(
              eq(
                userProfiles.class,
                sql`(SELECT number FROM ${classes} WHERE id = ${input.id})`
              ),
              eq(userProfiles.role, "STUDENT")
            )
          );

        if (studentCount.count > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Cannot delete class with ${studentCount.count} enrolled students`,
          });
        }

        const [deletedClass] = await db
          .delete(classes)
          .where(eq(classes.id, input.id))
          .returning();

        if (!deletedClass) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Class not found",
          });
        }

        return deletedClass;
      } catch (error) {
        console.error("Error deleting class:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to delete class",
          cause: error,
        });
      }
    }),

  // Toggle class active status (admin only)
  toggleClassStatus: adminProcedure
    .input(classIdSchema)
    .mutation(async ({ input }) => {
      try {
        const [currentClass] = await db
          .select()
          .from(classes)
          .where(eq(classes.id, input.id));

        if (!currentClass) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Class not found",
          });
        }

        const [updatedClass] = await db
          .update(classes)
          .set({
            isActive: !currentClass.isActive,
            updatedAt: new Date(),
          })
          .where(eq(classes.id, input.id))
          .returning();

        return updatedClass;
      } catch (error) {
        console.error("Error toggling class status:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to toggle class status",
          cause: error,
        });
      }
    }),
});
