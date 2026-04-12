"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  CheckCircle2,
  Circle,
  Loader2,
  StickyNote,
} from "lucide-react";
import Link from "next/link";
import { DualToneProgress } from "./dual-tone-progress";

type Props = { bookId: string };

export function StudentBookChaptersView({ bookId }: Props) {
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

  let book: (typeof data.subjects)[number]["books"][number] | undefined;
  let subject: (typeof data.subjects)[number] | undefined;
  for (const s of data.subjects) {
    const b = s.books.find((x) => x.id === bookId);
    if (b) {
      book = b;
      subject = s;
      break;
    }
  }

  if (!book || !subject) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Book not found.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/dashboard">Back home</Link>
        </Button>
      </div>
    );
  }

  const resumeChapterId =
    book.chapters.find((c) => c.isInSession)?.chapterId ??
    book.chapters.find((c) => !c.completed && c.isReadable)?.chapterId ??
    null;

  const defaultOpen = resumeChapterId ?? book.chapters[0]?.chapterId;

  const readableCount = book.chapters.filter((c) => c.isReadable).length;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <Link
          href={`/learn/subjects/${subject.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          <ArrowLeft className="size-4" />
          Back to Subject
        </Link>

        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500 px-6 py-7 text-white shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <BookOpen className="size-7" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {book.title}
              </h1>
              <p className="mt-1 text-sm text-white/90">
                {book.completedCount}/{book.totalChapters} chapters ·{" "}
                {book.progressPercent}% complete
              </p>
              <DualToneProgress
                value={book.progressPercent}
                className="mt-4 h-2.5 bg-white/25"
                fillClassName="bg-white"
                trackClassName="bg-white/20"
              />
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200 bg-white"
            disabled
          >
            <BookMarked className="mr-2 size-4" />
            Bookmarks (0)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border-slate-200 bg-white"
            disabled
          >
            <StickyNote className="mr-2 size-4" />
            Notes (0)
          </Button>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
            <BookOpen className="size-4 text-violet-600" />
            Chapters
          </h2>

          {book.chapters.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-10 text-center shadow-sm">
              <BookOpen className="mx-auto size-12 text-slate-300" />
              <p className="mt-4 text-sm text-muted-foreground">
                Chapters will appear here once the book is processed by AI.
              </p>
            </div>
          ) : readableCount === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-10 text-center shadow-sm">
              <BookOpen className="mx-auto size-12 text-slate-300" />
              <p className="mt-4 text-sm text-muted-foreground">
                Chapters will appear here once processing finishes.{" "}
                {book.chapters.length} chapter
                {book.chapters.length === 1 ? "" : "s"} detected.
              </p>
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              defaultValue={defaultOpen ? `item-${defaultOpen}` : undefined}
              className="space-y-2"
            >
              {book.chapters.map((ch) => {
                const isDone = ch.completed;
                const isCurrent =
                  !isDone &&
                  ch.isReadable &&
                  ch.chapterId === resumeChapterId;
                return (
                  <AccordionItem
                    key={ch.chapterId}
                    value={`item-${ch.chapterId}`}
                    className="rounded-xl border border-slate-100 bg-white px-4 shadow-sm data-[state=open]:shadow-md"
                  >
                    <AccordionTrigger className="py-4 hover:no-underline">
                      <div className="flex w-full items-start gap-3 text-left">
                        {isDone ? (
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                        ) : (
                          <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Ch. {ch.chapterNumber}
                            </span>
                            {isDone ? (
                              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                                Completed
                              </span>
                            ) : isCurrent ? (
                              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                                Current
                              </span>
                            ) : ch.isReadable ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                Available
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                                Processing
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-semibold text-slate-900">
                            {ch.title}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="border-t border-slate-50 pb-4 pt-3">
                      <p className="text-xs text-muted-foreground">
                        {ch.isReadable
                          ? "Read the chapter or continue your AI session from the chapter reader."
                          : ch.processingStatus === "PENDING" ||
                              ch.processingStatus === "PROCESSING"
                            ? "This chapter is still being processed."
                            : "This chapter is not available yet."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ch.isReadable ? (
                          <Button size="sm" className="rounded-lg" asChild>
                            <Link
                              href={`/study-materials/chapters/${ch.chapterId}`}
                            >
                              Open chapter
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}
