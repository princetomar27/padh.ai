"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type SelectBooksForSubjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with full selection when user confirms. */
  onConfirm: (bookIds: string[]) => void | Promise<void>;
  initialSelectedIds: string[];
};

export function SelectBooksForSubjectDialog({
  open,
  onOpenChange,
  onConfirm,
  initialSelectedIds,
}: SelectBooksForSubjectDialogProps) {
  const trpc = useTRPC();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const { data: books = [], isPending } = useQuery(
    trpc.books.list.queryOptions()
  );
  const { data: subjects = [] } = useQuery(trpc.subjects.listAll.queryOptions());
  const { data: classesData } = useQuery(
    trpc.classes.getMany.queryOptions({
      page: 1,
      pageSize: 50,
      search: "",
      classNumber: null,
      isActive: null,
    })
  );

  const subjectName = useMemo(
    () => new Map(subjects.map((s) => [s.id, s.name])),
    [subjects]
  );
  const classLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classesData?.items ?? []) {
      m.set(c.id, `Class ${c.number}`);
    }
    return m;
  }, [classesData?.items]);

  useEffect(() => {
    if (open) {
      setSelected(new Set(initialSelectedIds));
      setSearch("");
    }
  }, [open, initialSelectedIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books;
    return books.filter((b) => {
      const t = `${b.title} ${b.author ?? ""}`.toLowerCase();
      return t.includes(q);
    });
  }, [books, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden"
      >
        <div className="p-6 pb-4 border-b space-y-2">
          <DialogHeader className="text-left space-y-2">
            <DialogTitle>Select Books for Subject</DialogTitle>
            <DialogDescription>
              Choose books from the existing library or add new ones from Books.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search books by title or author..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 border-violet-200 focus-visible:ring-violet-500/30"
              />
            </div>
            <Button variant="outline" className="shrink-0" asChild>
              <Link href="/admin/books">+ Add New Book</Link>
            </Button>
          </div>
        </div>

        <div className="px-6 py-3">
          <p className="text-sm font-semibold text-foreground">
            Available Books ({filtered.length})
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-2 space-y-2">
          {isPending && (
            <div className="flex justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin" />
              Loading…
            </div>
          )}
          {!isPending &&
            filtered.map((b) => {
              const isOn = selected.has(b.id);
              return (
                <div
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggle(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(b.id);
                    }
                  }}
                  className="w-full text-left rounded-xl border bg-card p-3 flex gap-3 items-start hover:border-violet-200 transition-colors cursor-pointer"
                >
                  <div
                    className="pt-0.5"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isOn}
                      onCheckedChange={() => toggle(b.id)}
                      className="border-violet-400 data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                    />
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                    <BookOpen className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold text-sm leading-tight">
                      {b.title}
                    </p>
                    {b.author ? (
                      <p className="text-xs text-muted-foreground">
                        by {b.author}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {subjectName.get(b.subjectId) ?? "Subject"}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {classLabel.get(b.classId) ?? "Class"}
                      </span>
                    </div>
                    {b.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 pt-0.5">
                        {b.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          {!isPending && filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">
              No books match your search.
            </p>
          )}
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/30 flex-row items-center justify-between sm:justify-between gap-4">
          <span className="text-sm text-muted-foreground">
            {selected.size} book(s) selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white"
              onClick={() => {
                void (async () => {
                  try {
                    await Promise.resolve(onConfirm([...selected]));
                    onOpenChange(false);
                  } catch {
                    /* errors handled by caller (e.g. toast) */
                  }
                })();
              }}
            >
              Confirm Selection
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
