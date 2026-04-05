"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Eye,
  Layers,
  Loader2,
  Pencil,
  Timer,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "COMPLETED") return "secondary";
  if (status === "FAILED" || status === "PARTIAL") return "destructive";
  if (status === "PROCESSING") return "default";
  return "outline";
}

export default function AdminChaptersView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: rows, isPending } = useQuery(
    trpc.chapters.listForAdmin.queryOptions(),
  );

  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  const subjects = useMemo(() => {
    if (!rows) return [];
    const s = new Set(rows.map((r) => r.subjectName));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const stats = useMemo(() => {
    if (!rows) {
      return {
        total: 0,
        active: 0,
        totalMinutes: 0,
        subjectCount: 0,
      };
    }
    const active = rows.filter((r) => r.isActive).length;
    const totalMinutes = rows.reduce((acc, r) => acc + (r.duration ?? 0), 0);
    const subjectCount = new Set(rows.map((r) => r.subjectName)).size;
    return {
      total: rows.length,
      active,
      totalMinutes,
      subjectCount,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (subjectFilter !== "all" && r.subjectName !== subjectFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${r.title} ${r.bookTitle} ${r.subjectName} ${r.className}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, subjectFilter]);

  const toggleActive = useMutation(
    trpc.chapters.updateChapter.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.chapters.listForAdmin.queryOptions());
      },
      onError: (e) => toast.error(e.message ?? "Could not update chapter"),
    }),
  );

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chapter management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Chapters extracted from NCERT PDFs after Inngest processing. Edit
          titles, descriptions, and visibility; read full segment text as admin
          or from the student study hub.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total chapters</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-600">
              <Timer className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {stats.totalMinutes || "—"}
              </p>
              <p className="text-xs text-muted-foreground">Est. minutes (sum)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">
                {stats.subjectCount}
              </p>
              <p className="text-xs text-muted-foreground">Subjects</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between space-y-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            All chapters
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Input
              placeholder="Search chapters…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-[220px]"
            />
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="sm:w-[180px]">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isPending && (
            <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading chapters…
            </div>
          )}
          {!isPending && (!rows || rows.length === 0) && (
            <p className="text-muted-foreground text-center py-12 text-sm">
              No chapters yet. Process a book from Books — chapters appear after
              Inngest finishes.
            </p>
          )}
          {!isPending && filtered.length === 0 && rows && rows.length > 0 && (
            <p className="text-muted-foreground text-center py-12 text-sm">
              No chapters match your filters.
            </p>
          )}
          {!isPending && filtered.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Card className="h-full border-border/80 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col gap-3 h-full">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <BookOpen className="h-5 w-5 shrink-0 text-primary mt-0.5" />
                          <div className="min-w-0">
                            <p className="font-medium leading-snug">{r.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Chapter {r.chapterNumber} · {r.bookTitle}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={r.isActive ? "default" : "secondary"}
                          className="shrink-0 text-[10px] uppercase tracking-wide"
                        >
                          {r.isActive ? "Active" : "Off"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline">{r.subjectName}</Badge>
                        <Badge variant="outline">{r.className}</Badge>
                        <Badge variant={statusBadgeVariant(r.processingStatus)}>
                          {r.processingStatus.replaceAll("_", " ")}
                        </Badge>
                      </div>

                      {r.description ? (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {r.description}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground line-clamp-2 italic">
                          No description — add one in Edit.
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                        <p>
                          <span className="font-medium text-foreground">Pages</span>{" "}
                          {r.startPage}–{r.endPage}
                        </p>
                        <p>
                          <span className="font-medium text-foreground">Chunks</span>{" "}
                          {r.totalChunks}
                        </p>
                        {r.duration != null ? (
                          <p className="col-span-2">
                            <span className="font-medium text-foreground">
                              Duration
                            </span>{" "}
                            {r.duration} min
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 mt-auto border-t">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={r.isActive}
                            disabled={toggleActive.isPending}
                            onCheckedChange={(on) => {
                              toggleActive.mutate({ id: r.id, isActive: on });
                            }}
                          />
                          <span className="text-xs text-muted-foreground">
                            Visible to students
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" asChild title="View">
                            <Link href={`/admin/chapters/${r.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild title="Edit">
                            <Link href={`/admin/chapters/${r.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
