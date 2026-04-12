"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { DualToneProgress } from "./dual-tone-progress";
import { SubjectIcon } from "./subject-icon";
import { cn } from "@/lib/utils";

type Props = { subjectId: string };

export function StudentSubjectBooksView({ subjectId }: Props) {
  const trpc = useTRPC();
  const { data, isPending, isError, error } = useQuery(
    trpc.chapters.studentLearningTree.queryOptions(),
  );

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8">
        <p className="text-destructive text-sm">{error.message}</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/dashboard">Back home</Link>
        </Button>
      </div>
    );
  }

  const subject = data.subjects.find((s) => s.id === subjectId);
  if (!subject) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Subject not found.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/dashboard">Back home</Link>
        </Button>
      </div>
    );
  }

  const headerStyle =
    subject.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(subject.color)
      ? {
          background: `linear-gradient(105deg, ${subject.color}, ${subject.color}cc)`,
        }
      : undefined;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <Link
          href="/learn/subjects"
          className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          <ArrowLeft className="size-4" />
          Back to Subjects
        </Link>

        <section
          className={cn(
            "overflow-hidden rounded-2xl px-6 py-7 text-white shadow-lg",
            !headerStyle &&
              "bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600",
          )}
          style={headerStyle}
        >
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <SubjectIcon iconName={subject.icon} className="size-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {subject.name}
              </h1>
              <p className="mt-1 text-sm text-white/90">
                {subject.bookCount} books · {subject.progressPercent}% complete
              </p>
            </div>
          </div>
        </section>

        <div>
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Books
          </h2>
          {subject.books.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-muted-foreground">
              No books linked to this subject yet.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {subject.books.map((book) => (
                <li key={book.id}>
                  <Link
                    href={`/learn/books/${book.id}`}
                    className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                        <BookOpen className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900">
                          {book.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {book.completedCount}/{book.totalChapters} chapters
                          {book.resumeChapterNumber != null ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-violet-600/90">
                              <Clock className="size-3.5" />
                              Ch. {book.resumeChapterNumber}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-violet-600 sm:hidden">
                        {book.progressPercent}%
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-xs">
                      <DualToneProgress value={book.progressPercent} />
                      <span className="hidden text-right text-sm font-semibold text-violet-600 sm:block">
                        {book.progressPercent}%
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
