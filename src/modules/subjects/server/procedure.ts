import { db } from "@/db";
import {
  books,
  chapters,
  classSubjects,
  classes,
  subjects,
} from "@/db/schema";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import {
  and,
  asc,
  count,
  eq,
  getTableColumns,
  ilike,
  inArray,
  or,
} from "drizzle-orm";
import {
  adminListInputSchema,
  assignBooksInputSchema,
  createSubjectInputSchema,
  subjectIdSchema,
  updateSubjectInputSchema,
} from "../schemas";

function slugCodeFromName(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "_")
    .toUpperCase()
    .slice(0, 24);
  return base || "SUBJECT";
}

async function uniqueSubjectCode(base: string) {
  let code = base;
  let n = 0;
  for (;;) {
    const existing = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.code, code))
      .limit(1);
    if (existing.length === 0) return code;
    n += 1;
    code = `${base}_${n}`;
  }
}

async function dashboardStats() {
  const [[{ n: totalSubjects }], [{ n: activeSubjects }], [{ n: totalBooks }], [{ n: totalChapters }]] =
    await Promise.all([
      db.select({ n: count() }).from(subjects),
      db.select({ n: count() }).from(subjects).where(eq(subjects.isActive, true)),
      db.select({ n: count() }).from(books),
      db.select({ n: count() }).from(chapters),
    ]);
  return {
    totalSubjects,
    activeSubjects,
    totalBooks,
    totalChapters,
  };
}

/**
 * Subjects API for admin content tools and taxonomy screens.
 */
export const subjectsRouter = createTRPCRouter({
  listActive: adminProcedure.query(async () => {
    return db
      .select()
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(asc(subjects.name));
  }),

  /** All subjects (includes inactive). Prefer `adminList` for the admin UI. */
  listAll: adminProcedure.query(async () => {
    return db.select().from(subjects).orderBy(asc(subjects.name));
  }),

  adminList: adminProcedure.input(adminListInputSchema).query(async ({ input }) => {
    const search = input.search?.trim();
    const classId = input.classId?.trim();

    const searchCond =
      search && search.length > 0
        ? or(ilike(subjects.name, `%${search}%`), ilike(subjects.code, `%${search}%`))
        : undefined;

    const subjectRows = classId
      ? await db
          .select(getTableColumns(subjects))
          .from(subjects)
          .innerJoin(classSubjects, eq(subjects.id, classSubjects.subjectId))
          .where(and(eq(classSubjects.classId, classId), searchCond))
          .orderBy(asc(subjects.name))
      : await db
          .select()
          .from(subjects)
          .where(searchCond)
          .orderBy(asc(subjects.name));

    const stats = await dashboardStats();

    const ids = subjectRows.map((s) => s.id);
    if (ids.length === 0) {
      return { stats, items: [] };
    }

    const csRows = await db
      .select({
        subjectId: classSubjects.subjectId,
        classId: classes.id,
        number: classes.number,
        name: classes.name,
      })
      .from(classSubjects)
      .innerJoin(classes, eq(classSubjects.classId, classes.id))
      .where(inArray(classSubjects.subjectId, ids));

    const bookCountRows = await db
      .select({
        subjectId: books.subjectId,
        n: count(),
      })
      .from(books)
      .where(inArray(books.subjectId, ids))
      .groupBy(books.subjectId);

    const chapterCountRows = await db
      .select({
        subjectId: chapters.subjectId,
        n: count(),
      })
      .from(chapters)
      .where(inArray(chapters.subjectId, ids))
      .groupBy(chapters.subjectId);

    const bookListRows = await db
      .select({
        id: books.id,
        title: books.title,
        author: books.author,
        subjectId: books.subjectId,
        classId: books.classId,
      })
      .from(books)
      .where(inArray(books.subjectId, ids))
      .orderBy(asc(books.title));

    const bookCountMap = new Map(bookCountRows.map((r) => [r.subjectId, r.n]));
    const chapterCountMap = new Map(chapterCountRows.map((r) => [r.subjectId, r.n]));

    const classesBySubject = new Map<
      string,
      { classId: string; number: number; name: string }[]
    >();
    for (const row of csRows) {
      const list = classesBySubject.get(row.subjectId) ?? [];
      list.push({
        classId: row.classId,
        number: row.number,
        name: row.name,
      });
      classesBySubject.set(row.subjectId, list);
    }

    const booksBySubject = new Map<string, typeof bookListRows>();
    for (const b of bookListRows) {
      const list = booksBySubject.get(b.subjectId) ?? [];
      list.push(b);
      booksBySubject.set(b.subjectId, list);
    }

    const items = subjectRows.map((s) => {
      const linked = classesBySubject.get(s.id) ?? [];
      const sorted = [...linked].sort((a, b) => b.number - a.number);
      const primary = sorted[0];
      const classLabel =
        sorted.length === 0
          ? "No class linked"
          : sorted.length === 1
            ? `Class ${sorted[0]!.number}`
            : `Classes ${[...sorted].sort((a, b) => a.number - b.number).map((c) => c.number).join(", ")}`;

      const allBooks = booksBySubject.get(s.id) ?? [];
      const displayBooks = primary
        ? allBooks.filter((b) => b.classId === primary.classId)
        : allBooks;

      return {
        ...s,
        classLabel,
        primaryClassId: primary?.classId ?? null,
        bookCount: bookCountMap.get(s.id) ?? 0,
        chapterCount: chapterCountMap.get(s.id) ?? 0,
        associatedBooks: displayBooks.slice(0, 6).map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
        })),
      };
    });

    return { stats, items };
  }),

  create: adminProcedure.input(createSubjectInputSchema).mutation(async ({ input }) => {
    const baseCode = slugCodeFromName(input.name);
    const code = await uniqueSubjectCode(baseCode);

    const [cls] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.id, input.classId))
      .limit(1);
    if (!cls) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid class" });
    }

    const [created] = await db
      .insert(subjects)
      .values({
        name: input.name.trim(),
        code,
        description: input.description?.trim() || null,
        icon: input.icon?.trim() || null,
        color: input.color?.trim() || null,
        isActive: true,
      })
      .returning();

    if (!created) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create subject",
      });
    }

    await db.insert(classSubjects).values({
      classId: input.classId,
      subjectId: created.id,
      isActive: true,
    });

    return created;
  }),

  update: adminProcedure.input(updateSubjectInputSchema).mutation(async ({ input }) => {
    const [cls] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.id, input.classId))
      .limit(1);
    if (!cls) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid class" });
    }

    const [updated] = await db
      .update(subjects)
      .set({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        icon: input.icon?.trim() || null,
        color: input.color?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(subjects.id, input.id))
      .returning();

    if (!updated) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Subject not found" });
    }

    await db.delete(classSubjects).where(eq(classSubjects.subjectId, input.id));
    await db.insert(classSubjects).values({
      classId: input.classId,
      subjectId: input.id,
      isActive: true,
    });

    return updated;
  }),

  remove: adminProcedure.input(subjectIdSchema).mutation(async ({ input }) => {
    const [{ n: bookN }] = await db
      .select({ n: count() })
      .from(books)
      .where(eq(books.subjectId, input.id));

    if (bookN > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Cannot delete subject with ${bookN} book(s). Reassign or remove books first.`,
      });
    }

    const [deleted] = await db.delete(subjects).where(eq(subjects.id, input.id)).returning();
    if (!deleted) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Subject not found" });
    }
    return deleted;
  }),

  toggleActive: adminProcedure.input(subjectIdSchema).mutation(async ({ input }) => {
    const [current] = await db.select().from(subjects).where(eq(subjects.id, input.id)).limit(1);
    if (!current) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Subject not found" });
    }
    const [updated] = await db
      .update(subjects)
      .set({ isActive: !current.isActive, updatedAt: new Date() })
      .where(eq(subjects.id, input.id))
      .returning();
    return updated!;
  }),

  assignBooks: adminProcedure.input(assignBooksInputSchema).mutation(async ({ input }) => {
    if (input.bookIds.length === 0) {
      return { ok: true as const, updated: 0 };
    }

    const [cls] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(eq(classes.id, input.classId))
      .limit(1);
    if (!cls) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid class" });
    }

    const [subj] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.id, input.subjectId))
      .limit(1);
    if (!subj) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Subject not found" });
    }

    await db
      .update(books)
      .set({
        subjectId: input.subjectId,
        classId: input.classId,
        updatedAt: new Date(),
      })
      .where(inArray(books.id, input.bookIds));

    return { ok: true as const, updated: input.bookIds.length };
  }),
});
