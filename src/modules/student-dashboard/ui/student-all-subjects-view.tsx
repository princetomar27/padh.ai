"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { DualToneProgress } from "./dual-tone-progress";
import { SubjectIcon } from "./subject-icon";
import { cn } from "@/lib/utils";

const SUBJECT_FALLBACK_ACCENTS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-pink-500 to-rose-600",
  "from-violet-500 to-purple-600",
];

export function StudentAllSubjectsView() {
  const trpc = useTRPC();
  const { data, isPending, isError, error } = useQuery(
    trpc.chapters.studentLearningTree.queryOptions(),
  );

  if (isPending) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading subjects…
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

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">My Subjects 📚</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.subjects.map((subject, i) => {
            const accent =
              subject.color &&
              /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(subject.color)
                ? { backgroundColor: subject.color }
                : undefined;
            const gradientClass = !accent
              ? cn(
                  "bg-gradient-to-br",
                  SUBJECT_FALLBACK_ACCENTS[i % SUBJECT_FALLBACK_ACCENTS.length]!,
                )
              : "";
            const remainingBooks = Math.max(
              0,
              subject.bookCount -
                subject.books.filter((b) => b.progressPercent >= 100).length,
            );
            return (
              <Link
                key={subject.id}
                href={`/learn/subjects/${subject.id}`}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div
                  className={cn(
                    "flex h-28 items-center justify-center text-white",
                    gradientClass,
                  )}
                  style={accent}
                >
                  <SubjectIcon
                    iconName={subject.icon}
                    className="size-12 opacity-95 drop-shadow-sm"
                  />
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-slate-900">{subject.name}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {subject.bookCount} books ·{" "}
                    {
                      subject.books.filter((b) => b.progressPercent >= 100)
                        .length
                    }{" "}
                    completed
                  </p>
                  <DualToneProgress
                    value={subject.progressPercent}
                    className="mt-3"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-violet-600">
                      {subject.progressPercent}% complete
                    </span>
                    <span>{remainingBooks} remaining</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
