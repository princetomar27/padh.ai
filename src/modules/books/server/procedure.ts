import { db } from "@/db";
import { books } from "@/db/schema";
import { ingest } from "@/inngest/client";
import { adminProcedure, createTRPCRouter } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import {
  bookIdSchema,
  createBookSchema,
  enqueueBookProcessSchema,
} from "../schemas";

export const booksRouter = createTRPCRouter({
  list: adminProcedure.query(async () => {
    return db.select().from(books).orderBy(desc(books.createdAt));
  }),

  getById: adminProcedure.input(bookIdSchema).query(async ({ input }) => {
      const [row] = await db
        .select()
        .from(books)
        .where(eq(books.id, input.bookId))
        .limit(1);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      }
      return row;
    }),

  create: adminProcedure.input(createBookSchema).mutation(async ({ input }) => {
    const [book] = await db
      .insert(books)
      .values({
        title: input.title,
        description: input.description,
        author: input.author,
        publisher: input.publisher,
        isbn: input.isbn,
        subjectId: input.subjectId,
        classId: input.classId,
        supabaseStorageUrl: input.supabaseStorageUrl,
        pdfSize: input.pdfSize,
        processingStatus: "PENDING",
        totalPages: 0,
      })
      .returning();

    if (!book) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create book",
      });
    }

    await ingest.send({
      name: "padhai/book.process",
      data: { bookId: book.id },
    });

    return book;
  }),

  enqueueProcessing: adminProcedure
    .input(enqueueBookProcessSchema)
    .mutation(async ({ input }) => {
      const [book] = await db
        .select({ id: books.id })
        .from(books)
        .where(eq(books.id, input.bookId))
        .limit(1);
      if (!book) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Book not found" });
      }

      await ingest.send({
        name: "padhai/book.process",
        data: {
          bookId: input.bookId,
          forceReprocess: input.forceReprocess,
        },
      });

      return { ok: true as const, bookId: input.bookId };
    }),
});
