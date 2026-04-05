"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Loader2, Pencil } from "lucide-react";
import Link from "next/link";

type AdminChapterDetailViewProps = {
  chapterId: string;
};

export function AdminChapterDetailView({ chapterId }: AdminChapterDetailViewProps) {
  const trpc = useTRPC();
  const { data: ch, isPending, error } = useQuery(
    trpc.chapters.getByIdForAdmin.queryOptions({ id: chapterId }),
  );

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-24 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading chapter…
      </div>
    );
  }

  if (error || !ch) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-3">
        <p className="text-destructive text-sm">
          {error?.message ?? "Chapter not found."}
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/chapters">← All chapters</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/admin/chapters">← All chapters</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{ch.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ch.bookTitle} · {ch.subjectName} · {ch.className}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/admin/chapters/${chapterId}/edit`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={`/admin/chapters/${chapterId}/read`}>
              <BookOpen className="h-4 w-4 mr-2" />
              Read full chapter
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={ch.isActive ? "default" : "secondary"}>
          {ch.isActive ? "Active" : "Inactive"}
        </Badge>
        <Badge variant="outline">
          {ch.processingStatus.replaceAll("_", " ")}
        </Badge>
        {ch.questionsGenerated ? (
          <Badge variant="outline">Questions generated</Badge>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Structure</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1 text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Chapter #</span>{" "}
              {ch.chapterNumber}
            </p>
            <p>
              <span className="font-medium text-foreground">Pages</span>{" "}
              {ch.startPage}–{ch.endPage} (book has {ch.bookTotalPages} pages)
            </p>
            <p>
              <span className="font-medium text-foreground">Chunks</span>{" "}
              {ch.totalChunks}
            </p>
            {ch.duration != null ? (
              <p>
                <span className="font-medium text-foreground">Duration</span>{" "}
                {ch.duration} min (estimate)
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Objectives</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
            {ch.objectives?.trim() ? ch.objectives : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Description</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">
          {ch.description?.trim() ? ch.description : "—"}
        </CardContent>
      </Card>
    </div>
  );
}
