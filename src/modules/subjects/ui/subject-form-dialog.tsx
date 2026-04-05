"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AppRouter } from "@/trpc/routers/_app";
import { useTRPC } from "@/trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SelectBooksForSubjectDialog } from "./select-books-for-subject-dialog";
import {
  DEFAULT_SUBJECT_COLOR,
  DEFAULT_SUBJECT_ICON,
  SUBJECT_COLOR_OPTIONS,
  SUBJECT_ICON_OPTIONS,
} from "./subject-ui-options";
import { SubjectIcon } from "./subject-icon";

type RouterOutputs = inferRouterOutputs<AppRouter>;
export type AdminSubjectRow =
  RouterOutputs["subjects"]["adminList"]["items"][number];

type SubjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: AdminSubjectRow | null;
};

export function SubjectFormDialog({
  open,
  onOpenChange,
  subject,
}: SubjectFormDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isEdit = Boolean(subject);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState("");
  const [icon, setIcon] = useState(DEFAULT_SUBJECT_ICON);
  const [color, setColor] = useState(DEFAULT_SUBJECT_COLOR);
  const [stagedBookIds, setStagedBookIds] = useState<string[]>([]);
  const [booksPickerOpen, setBooksPickerOpen] = useState(false);

  const { data: classesData } = useQuery(
    trpc.classes.getMany.queryOptions({
      page: 1,
      pageSize: 50,
      search: "",
      classNumber: null,
      isActive: null,
    }),
  );
  const classItems = classesData?.items ?? [];

  const { data: allBooks = [] } = useQuery(trpc.books.list.queryOptions());

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: [["subjects", "adminList"]],
    });
    void queryClient.invalidateQueries(trpc.books.list.queryOptions());
  };

  useEffect(() => {
    if (!open) return;
    if (subject) {
      setName(subject.name);
      setDescription(subject.description ?? "");
      setClassId(subject.primaryClassId ?? "");
      setIcon(subject.icon?.trim() || DEFAULT_SUBJECT_ICON);
      setColor(subject.color?.trim() || DEFAULT_SUBJECT_COLOR);
      setStagedBookIds([]);
    } else {
      setName("");
      setDescription("");
      setClassId("");
      setIcon(DEFAULT_SUBJECT_ICON);
      setColor(DEFAULT_SUBJECT_COLOR);
      setStagedBookIds([]);
    }
  }, [open, subject]);

  const createMut = useMutation(
    trpc.subjects.create.mutationOptions({
      onError: (e) => toast.error(e.message),
    }),
  );
  const updateMut = useMutation(
    trpc.subjects.update.mutationOptions({
      onError: (e) => toast.error(e.message),
    }),
  );
  const assignMut = useMutation(
    trpc.subjects.assignBooks.mutationOptions({
      onError: (e) => toast.error(e.message),
    }),
  );

  const stagedTitles = useMemo(() => {
    const m = new Map(allBooks.map((b) => [b.id, b]));
    return stagedBookIds.map((id) => m.get(id)).filter(Boolean) as {
      id: string;
      title: string;
      author: string | null;
    }[];
  }, [allBooks, stagedBookIds]);

  const editAssociatedIds = useMemo(
    () => subject?.associatedBooks.map((b) => b.id) ?? [],
    [subject?.associatedBooks],
  );

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Subject name is required");
      return;
    }
    if (!classId) {
      toast.error("Select a class level");
      return;
    }

    try {
      if (isEdit && subject) {
        await updateMut.mutateAsync({
          id: subject.id,
          name: name.trim(),
          description: description.trim() || undefined,
          classId,
          icon: icon || undefined,
          color: color || undefined,
        });
        toast.success("Subject updated");
        invalidate();
        onOpenChange(false);
        return;
      }

      const created = await createMut.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        classId,
        icon: icon || undefined,
        color: color || undefined,
      });
      if (stagedBookIds.length > 0) {
        await assignMut.mutateAsync({
          subjectId: created.id,
          classId,
          bookIds: stagedBookIds,
        });
      }
      toast.success("Subject created");
      invalidate();
      onOpenChange(false);
    } catch {
      /* toast handled in mutation */
    }
  };

  const onBooksPicked = async (ids: string[]) => {
    if (!classId) {
      toast.error("Select a class level first");
      return;
    }
    if (isEdit && subject) {
      try {
        await assignMut.mutateAsync({
          subjectId: subject.id,
          classId,
          bookIds: ids,
        });
        toast.success("Books updated for this subject");
        invalidate();
      } catch {
        /* handled */
      }
      return;
    }
    setStagedBookIds(ids);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          className="sm:max-w-3xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Subject" : "Create New Subject"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the subject information and associated books"
                : "Add a new academic subject to the system"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="subj-name">Subject Name *</Label>
              <Input
                id="subj-name"
                placeholder="e.g., Physics"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="focus-visible:ring-violet-500/30 border-violet-200/80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subj-desc">Description</Label>
              <Textarea
                id="subj-desc"
                placeholder="e.g., Fundamental principles of matter and energy"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="resize-none focus-visible:ring-violet-500/30"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Class Level *</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
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
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={icon} onValueChange={setIcon}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Default (Book)" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_ICON_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <SubjectIcon
                            name={opt.value}
                            className="size-4 text-violet-600"
                          />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Color Theme</Label>
                <Select value={color} onValueChange={setColor}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Blue" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_COLOR_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className="size-3 rounded-full border border-border"
                            style={{ backgroundColor: opt.value }}
                          />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Associated Books</p>
                  <p className="text-xs text-muted-foreground">
                    {isEdit
                      ? "Select books that belong to this subject"
                      : "Click Add Books to link books to this subject"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-violet-200 text-violet-700 hover:bg-violet-50"
                  onClick={() => setBooksPickerOpen(true)}
                >
                  <Plus className="size-4 mr-1" />
                  Add Books
                </Button>
              </div>

              {isEdit && subject && subject.associatedBooks.length > 0 && (
                <ul className="text-sm space-y-1 border rounded-lg bg-background p-3">
                  {subject.associatedBooks.map((b) => (
                    <li key={b.id} className="text-muted-foreground">
                      <span className="text-foreground font-medium">
                        {b.title}
                      </span>
                      {b.author ? ` by ${b.author}` : ""}
                    </li>
                  ))}
                </ul>
              )}

              {!isEdit && stagedTitles.length > 0 && (
                <ul className="text-sm space-y-1 border rounded-lg bg-background p-3">
                  {stagedTitles.map((b) => (
                    <li key={b.id} className="text-muted-foreground">
                      <span className="text-foreground font-medium">
                        {b.title}
                      </span>
                      {b.author ? ` by ${b.author}` : ""}
                    </li>
                  ))}
                </ul>
              )}

              {((isEdit && subject && subject.associatedBooks.length === 0) ||
                (!isEdit && stagedTitles.length === 0)) && (
                <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground border border-dashed rounded-lg">
                  <BookOpen className="size-10 mb-2 opacity-30" />
                  <p>
                    No books selected. Click &quot;Add Books&quot; to associate
                    books with this subject
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="bg-violet-600 hover:bg-violet-700 text-white ml-4"
              disabled={createMut.isPending || updateMut.isPending}
              onClick={() => void handleSubmit()}
            >
              {(createMut.isPending || updateMut.isPending) && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              {isEdit ? "Update Subject" : "Create Subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SelectBooksForSubjectDialog
        open={booksPickerOpen}
        onOpenChange={setBooksPickerOpen}
        initialSelectedIds={isEdit ? editAssociatedIds : stagedBookIds}
        onConfirm={onBooksPicked}
      />
    </>
  );
}
