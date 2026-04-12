import { db } from "@/db";
import { books } from "@/db/schema";
import { getSessionUserProfile } from "@/lib/auth/session-user-profile";
import { resolveChapterPdfStoragePath } from "@/lib/book-pdf/resolve-chapter-pdf-storage-url";
import { fetchBookPdfBuffer } from "@/lib/supabase/fetch-book-pdf";
import { assertChapterReaderAccess } from "@/modules/chapters/server/chapter-reader-access";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { NextResponse } from "next/server";

function trpcErrorToHttp(e: TRPCError): number {
  switch (e.code) {
    case "NOT_FOUND":
      return 404;
    case "UNAUTHORIZED":
      return 401;
    case "BAD_REQUEST":
      return 400;
    default:
      return 403;
  }
}

/**
 * Streams the original chapter PDF (Supabase or public URL) after the same
 * access checks as the chapter reader. Used by the client pdf.js panel so
 * students are not dependent on Vercel Blob page images.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ chapterId: string }> },
) {
  try {
    const { user } = await getSessionUserProfile();
    const { chapterId } = await context.params;

    const chapter = await assertChapterReaderAccess({
      userRole: user.role,
      userClass: user.class,
      chapterId,
    });

    const [bookRow] = await db
      .select({
        supabaseStorageUrl: books.supabaseStorageUrl,
        chapterIngestSources: books.chapterIngestSources,
      })
      .from(books)
      .where(eq(books.id, chapter.bookId))
      .limit(1);

    if (!bookRow) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    const pathOrUrl = resolveChapterPdfStoragePath(
      {
        supabaseStorageUrl: bookRow.supabaseStorageUrl,
        chapterIngestSources: bookRow.chapterIngestSources,
      },
      chapter.chapterNumber,
    );

    const buffer = await fetchBookPdfBuffer(pathOrUrl);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    if (err instanceof TRPCError) {
      return NextResponse.json(
        { error: err.message },
        { status: trpcErrorToHttp(err) },
      );
    }
    const message = err instanceof Error ? err.message : "PDF load failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
