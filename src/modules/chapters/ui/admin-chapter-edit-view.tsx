"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type AdminChapterEditViewProps = {
  chapterId: string;
};

export function AdminChapterEditView({ chapterId }: AdminChapterEditViewProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: ch, isPending, error } = useQuery(
    trpc.chapters.getByIdForAdmin.queryOptions({ id: chapterId }),
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [durationStr, setDurationStr] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!ch) return;
    setTitle(ch.title);
    setDescription(ch.description ?? "");
    setObjectives(ch.objectives ?? "");
    setDurationStr(ch.duration != null ? String(ch.duration) : "");
    setIsActive(ch.isActive);
  }, [ch]);

  const update = useMutation(
    trpc.chapters.updateChapter.mutationOptions({
      onSuccess: () => {
        toast.success("Chapter updated");
        void queryClient.invalidateQueries(
          trpc.chapters.getByIdForAdmin.queryOptions({ id: chapterId }),
        );
        void queryClient.invalidateQueries(trpc.chapters.listForAdmin.queryOptions());
      },
      onError: (e) => {
        toast.error(e.message ?? "Update failed");
      },
    }),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const durationParsed =
      durationStr.trim() === "" ? null : Number.parseInt(durationStr, 10);
    if (
      durationStr.trim() !== "" &&
      (durationParsed == null ||
        !Number.isFinite(durationParsed) ||
        durationParsed < 1)
    ) {
      toast.error("Duration must be a positive number of minutes or empty.");
      return;
    }
    update.mutate({
      id: chapterId,
      title: title.trim(),
      description: description.trim() === "" ? null : description.trim(),
      objectives: objectives.trim() === "" ? null : objectives.trim(),
      duration: durationParsed,
      isActive,
    });
  };

  if (isPending) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-24 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
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
    <div className="flex flex-col gap-6 p-6 max-w-xl mx-auto">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
          <Link href={`/admin/chapters/${chapterId}`}>← Back to chapter</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Edit chapter</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {ch.bookTitle} · #{ch.chapterNumber}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="resize-y min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="objectives">Learning objectives (markdown ok)</Label>
          <Textarea
            id="objectives"
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={6}
            className="resize-y min-h-[120px] font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Estimated session length (minutes)</Label>
          <Input
            id="duration"
            type="number"
            min={1}
            placeholder="Optional"
            value={durationStr}
            onChange={(e) => setDurationStr(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium text-sm">Visible to students</p>
            <p className="text-xs text-muted-foreground">
              Inactive chapters stay hidden from the study catalog.
            </p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save changes"
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={`/admin/chapters/${chapterId}`}>Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
