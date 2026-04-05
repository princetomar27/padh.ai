"use client";

import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  FileText,
  Library,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SelectBooksForSubjectDialog } from "./select-books-for-subject-dialog";
import {
  SubjectFormDialog,
  type AdminSubjectRow,
} from "./subject-form-dialog";
import { SubjectIcon } from "./subject-icon";

const VIOLET = "#8b5cf6";

export default function AdminSubjectsView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<AdminSubjectRow | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminSubjectRow | null>(
    null
  );
  const [manageBooksSubject, setManageBooksSubject] =
    useState<AdminSubjectRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const listOpts = trpc.subjects.adminList.queryOptions({
    search: debouncedSearch.trim() || undefined,
    classId: classFilter.trim() || undefined,
  });

  const { data, isPending } = useQuery(listOpts);

  const { data: classesData } = useQuery(
    trpc.classes.getMany.queryOptions({
      page: 1,
      pageSize: 50,
      search: "",
      classNumber: null,
      isActive: null,
    })
  );
  const classItems = classesData?.items ?? [];

  const { data: allBooks = [] } = useQuery(trpc.books.list.queryOptions());

  const manageBooksInitialIds = useMemo(() => {
    if (!manageBooksSubject?.primaryClassId) return [];
    return allBooks
      .filter(
        (b) =>
          b.subjectId === manageBooksSubject.id &&
          b.classId === manageBooksSubject.primaryClassId
      )
      .map((b) => b.id);
  }, [allBooks, manageBooksSubject]);

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [["subjects", "adminList"]],
    });
    void queryClient.invalidateQueries(trpc.books.list.queryOptions());
  };

  const toggleMut = useMutation(
    trpc.subjects.toggleActive.mutationOptions({
      onSuccess: () => {
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const deleteMut = useMutation(
    trpc.subjects.remove.mutationOptions({
      onSuccess: () => {
        toast.success("Subject deleted");
        setDeleteTarget(null);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const assignMut = useMutation(
    trpc.subjects.assignBooks.mutationOptions({
      onSuccess: () => {
        toast.success("Books updated for this subject");
        setManageBooksSubject(null);
        invalidate();
      },
      onError: (e) => toast.error(e.message),
    })
  );

  const stats = data?.stats;
  const items = data?.items ?? [];

  const openCreate = () => {
    setEditingSubject(null);
    setFormOpen(true);
  };

  const openEdit = (s: AdminSubjectRow) => {
    setEditingSubject(s);
    setFormOpen(true);
  };

  const onFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingSubject(null);
  };

  const openManageBooks = (s: AdminSubjectRow) => {
    if (!s.primaryClassId) {
      toast.error("Link this subject to a class before managing books.");
      return;
    }
    setManageBooksSubject(s);
  };

  return (
    <div className="min-h-full bg-muted/40">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Educational Content Management
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Subject Management
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Manage academic subjects and their associated books
            </p>
          </div>
          <Button
            className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
            onClick={openCreate}
          >
            + Add New Subject
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Subjects"
            value={stats?.totalSubjects ?? "—"}
            icon={<BookOpen className="size-5 text-white" />}
            iconBg="bg-violet-600"
          />
          <StatCard
            label="Active Subjects"
            value={stats?.activeSubjects ?? "—"}
            icon={<BookOpen className="size-5 text-white" />}
            iconBg="bg-teal-500"
          />
          <StatCard
            label="Total Books"
            value={stats?.totalBooks ?? "—"}
            icon={<Library className="size-5 text-white" />}
            iconBg="bg-pink-500"
          />
          <StatCard
            label="Total Chapters"
            value={stats?.totalChapters ?? "—"}
            icon={<FileText className="size-5 text-white" />}
            iconBg="bg-violet-500"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-background border rounded-xl p-4 shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search subjects..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={classFilter || "all"}
            onValueChange={(v) => setClassFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-[200px] shrink-0">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classItems
                .slice()
                .sort((a, b) => a.number - b.number)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    Class {c.number}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {isPending && (
          <div className="flex justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="size-6 animate-spin" />
            Loading subjects…
          </div>
        )}

        {!isPending && items.length === 0 && (
          <div className="text-center py-20 text-muted-foreground border rounded-xl bg-background">
            No subjects match your filters. Add a subject or adjust search.
          </div>
        )}

        {!isPending && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((s) => (
              <article
                key={s.id}
                className="rounded-xl border bg-card shadow-sm flex flex-col overflow-hidden"
              >
                <div className="p-4 space-y-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="size-11 rounded-lg flex items-center justify-center shrink-0 text-white shadow-sm"
                        style={{
                          backgroundColor: s.color?.trim() || VIOLET,
                        }}
                      >
                        <SubjectIcon name={s.icon} className="size-6" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-lg leading-tight truncate">
                          {s.name}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          {s.classLabel}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={
                        s.isActive
                          ? "shrink-0 bg-violet-600 text-white hover:bg-violet-600 border-0"
                          : "shrink-0 bg-teal-100 text-teal-800 hover:bg-teal-100 border-teal-200"
                      }
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {s.description ||
                      "No description yet. Edit this subject to add one."}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/60 px-3 py-2 text-center">
                      <p className="text-lg font-semibold tabular-nums">
                        {s.bookCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Books</p>
                    </div>
                    <div className="rounded-lg bg-muted/60 px-3 py-2 text-center">
                      <p className="text-lg font-semibold tabular-nums">
                        {s.chapterCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Chapters</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Associated Books
                    </p>
                    {s.associatedBooks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No books linked for this class yet.
                      </p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {s.associatedBooks.map((b) => (
                          <li key={b.id} className="text-muted-foreground">
                            <span className="text-foreground">{b.title}</span>
                            {b.author ? (
                              <span className="text-muted-foreground">
                                {" "}
                                by {b.author}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <footer className="flex items-center gap-2 px-4 py-3 border-t bg-muted/20 flex-wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label="Edit subject"
                    onClick={() => openEdit(s)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-foreground/20 text-foreground gap-1.5"
                    onClick={() => openManageBooks(s)}
                  >
                    <Library className="size-4" />
                    Manage Books
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                    aria-label="Delete subject"
                    onClick={() => setDeleteTarget(s)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <div className="ml-auto flex items-center gap-2">
                    <Switch
                      checked={s.isActive}
                      disabled={toggleMut.isPending}
                      onCheckedChange={() =>
                        toggleMut.mutate({ id: s.id })
                      }
                      className="data-[state=checked]:bg-violet-600"
                    />
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </div>

      <SubjectFormDialog
        open={formOpen}
        onOpenChange={onFormOpenChange}
        subject={editingSubject}
      />

      <SelectBooksForSubjectDialog
        open={manageBooksSubject !== null}
        onOpenChange={(o) => {
          if (!o) setManageBooksSubject(null);
        }}
        initialSelectedIds={manageBooksInitialIds}
        onConfirm={async (ids) => {
          const subj = manageBooksSubject;
          if (!subj?.primaryClassId) return;
          await assignMut.mutateAsync({
            subjectId: subj.id,
            classId: subj.primaryClassId,
            bookIds: ids,
          });
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete subject?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              . You cannot delete a subject that still has books — reassign
              them first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (deleteTarget) deleteMut.mutate({ id: deleteTarget.id });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  iconBg: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center gap-3">
      <div
        className={`size-11 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}
