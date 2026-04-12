import "server-only";

import { db } from "@/db";
import { books, chapters, classes, subjects } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

export async function assertChapterReaderAccess(opts: {
  userRole: "STUDENT" | "PARENT" | "ADMIN";
  userClass: number | null;
  chapterId: string;
}) {
  const [row] = await db
    .select({
      id: chapters.id,
      title: chapters.title,
      chapterNumber: chapters.chapterNumber,
      startPage: chapters.startPage,
      endPage: chapters.endPage,
      description: chapters.description,
      objectives: chapters.objectives,
      duration: chapters.duration,
      processingStatus: chapters.processingStatus,
      totalChunks: chapters.totalChunks,
      isActive: chapters.isActive,
      questionsGenerated: chapters.questionsGenerated,
      bookId: chapters.bookId,
      bookTitle: books.title,
      subjectId: subjects.id,
      subjectName: subjects.name,
      classId: classes.id,
      classNumber: classes.number,
      className: classes.name,
    })
    .from(chapters)
    .innerJoin(books, eq(chapters.bookId, books.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .innerJoin(classes, eq(chapters.classId, classes.id))
    .where(eq(chapters.id, opts.chapterId))
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found." });
  }

  if (opts.userRole === "ADMIN") {
    return row;
  }

  if (opts.userRole === "PARENT") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Parents cannot open chapter reader content.",
    });
  }

  if (opts.userRole !== "STUDENT") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
  }

  if (opts.userClass == null) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Set your class in onboarding to view chapters.",
    });
  }

  if (row.classNumber !== opts.userClass) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This chapter is not available for your class.",
    });
  }

  if (!row.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This chapter is not available.",
    });
  }

  if (row.processingStatus !== "COMPLETED") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This chapter is still being processed.",
    });
  }

  return row;
}
