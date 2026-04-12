"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import {
  BookOpen,
  Clock,
  Flame,
  LayoutGrid,
  Loader2,
  Pencil,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";
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

type StudentDashboardViewProps = {
  displayName: string;
};

export function StudentDashboardView({ displayName }: StudentDashboardViewProps) {
  const trpc = useTRPC();
  const treeQuery = useQuery(trpc.chapters.studentLearningTree.queryOptions());
  const testsQuery = useQuery(trpc.learning.listAvailableTests.queryOptions());

  if (treeQuery.isPending) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading your dashboard…
      </div>
    );
  }

  if (treeQuery.isError) {
    return (
      <div className="mx-auto max-w-lg flex-1 p-8">
        <p className="text-destructive text-sm">{treeQuery.error.message}</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link href="/onboarding">Complete setup</Link>
        </Button>
      </div>
    );
  }

  const data = treeQuery.data;
  const firstName = displayName.split(/\s+/)[0] || "Student";
  const { stats } = data;

  const continueBooks = data.subjects
    .flatMap((s) =>
      s.books.map((b) => ({
        ...b,
        subjectName: s.name,
        subjectId: s.id,
      })),
    )
    .filter((b) => b.totalChapters > 0)
    .sort((a, b) => {
      const ta = a.lastStudiedAt ? new Date(a.lastStudiedAt).getTime() : 0;
      const tb = b.lastStudiedAt ? new Date(b.lastStudiedAt).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 6);

  const avgScoreLabel =
    stats.avgScorePercent != null ? `${stats.avgScorePercent}%` : "—";

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/80">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero */}
        <section
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-500 to-fuchsia-500 px-6 py-8 text-white shadow-lg shadow-violet-500/20 sm:px-8"
        >
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Hey, {firstName}! 👋
              </h1>
              <p className="mt-1 text-sm text-white/90 sm:text-base">
                Let&apos;s continue your learning streak!
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                <Flame className="size-3.5 opacity-90" />
                {stats.booksReading > 0 ? "On track" : "0 day streak"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                <Trophy className="size-3.5 opacity-90" />
                Class {data.classNumber}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
                <Zap className="size-3.5 opacity-90" />
                {stats.testsTaken} tests
              </span>
            </div>
          </div>
        </section>

        {/* Quick stats */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={BookOpen}
            label="Subjects"
            value={`${stats.subjectCount} Subjects`}
          />
          <StatCard
            icon={Target}
            label="Books reading"
            value={`${stats.booksReading} Books Reading`}
          />
          <StatCard
            icon={Trophy}
            label="Tests taken"
            value={`${stats.testsTaken} Tests Taken`}
          />
          <StatCard
            icon={TrendingUp}
            label="Average"
            value={`${avgScoreLabel} Avg Score`}
          />
        </section>

        {/* Continue reading */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Continue Reading 📚
            </h2>
            <Link
              href="/learn/subjects"
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              View all →
            </Link>
          </div>
          {continueBooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-muted-foreground">
              No books yet for Class {data.classNumber}. Your admin can upload
              textbooks; then they&apos;ll show up here.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {continueBooks.map((book) => (
                <Link
                  key={book.id}
                  href={`/learn/books/${book.id}`}
                  className="group rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                      <BookOpen className="size-5" />
                    </div>
                    {book.resumeChapterNumber != null ? (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        Ch. {book.resumeChapterNumber}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900 group-hover:text-violet-700">
                    {book.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {book.subjectName} · {book.completedCount}/
                    {book.totalChapters} chapters
                  </p>
                  <DualToneProgress
                    value={book.progressPercent}
                    className="mt-3"
                  />
                  <p className="mt-2 text-xs font-medium text-violet-600">
                    {book.progressPercent}% complete
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* My subjects */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              My Subjects 📚
            </h2>
            <Link
              href="/learn/subjects"
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              View all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.subjects.map((subject, i) => {
              const accent =
                subject.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(subject.color)
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
                    <h3 className="font-semibold text-slate-900">
                      {subject.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {subject.bookCount} books ·{" "}
                      {
                        subject.books.filter(
                          (b) =>
                            b.totalChapters > 0 &&
                            b.completedCount >= b.totalChapters,
                        ).length
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
        </section>

        {/* Available tests */}
        <section className="pb-10">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              Available Tests
            </h2>
            <Pencil className="size-5 text-emerald-600" aria-hidden />
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Test your knowledge and track your progress.
          </p>
          {testsQuery.isPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading tests…
            </div>
          ) : testsQuery.data && testsQuery.data.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {testsQuery.data.map((t) => (
                <article
                  key={t.id}
                  className="flex flex-col rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-pink-100 text-pink-600">
                      <LayoutGrid className="size-5" />
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                        t.difficulty === "EASY" &&
                          "bg-emerald-100 text-emerald-800",
                        t.difficulty === "MEDIUM" &&
                          "bg-amber-100 text-amber-900",
                        t.difficulty === "HARD" && "bg-red-100 text-red-800",
                      )}
                    >
                      {t.difficulty.toLowerCase()}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">
                    {t.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t.subjectName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="size-3.5" />
                      {t.questionCount} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {t.duration} min
                    </span>
                  </div>
                  <Button
                    className="mt-4 w-full rounded-lg bg-fuchsia-600 font-semibold hover:bg-fuchsia-700"
                    asChild
                  >
                    <Link href={`/study-materials/chapters/${t.chapterId}`}>
                      Start Test
                    </Link>
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-muted-foreground">
              No mock tests yet. They appear here once your teacher adds tests
              for your chapters.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <div className="flex size-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
