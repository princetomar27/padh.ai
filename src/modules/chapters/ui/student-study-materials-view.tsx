"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Headphones, Loader2 } from "lucide-react";
import Link from "next/link";

export function StudentStudyMaterialsView() {
  const trpc = useTRPC();
  const {
    data: rows,
    isPending,
    error,
  } = useQuery(trpc.chapters.listForStudy.queryOptions());
  const { data: sessions } = useQuery(
    trpc.learning.listMySessions.queryOptions(),
  );
  const activeSession = sessions?.find(
    (s) => s.status === "ACTIVE" || s.status === "PAUSED",
  );

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-24 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading your chapters…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <p className="text-destructive text-sm">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Study materials
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Chapters from books for your class. Open a chapter to read the full
          processed text.
        </p>
      </div>

      {activeSession ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Headphones className="h-4 w-4 text-primary" />
              <span>You have a voice session in progress.</span>
            </div>
            <Button size="sm" asChild>
              <Link href={`/study-materials/sessions/${activeSession.id}`}>
                Continue session
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!rows?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No chapters available yet. Ask your admin to upload and process
            books for your class.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-5 w-5 shrink-0 text-primary" />
                      <span className="font-medium leading-snug">
                        {r.title}
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      Ch. {r.chapterNumber}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.subjectName} · {r.bookTitle}
                  </p>
                  {r.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {r.description}
                    </p>
                  ) : null}
                  <div className="mt-auto pt-2">
                    <Button size="sm" asChild>
                      <Link href={`/study-materials/chapters/${r.id}`}>
                        Read chapter
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
