"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, FileUp, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type AddBookModalProps = {
  children?: React.ReactNode;
};

async function uploadPdfFile(
  file: File,
  onProgress: (pct: number | null) => void,
): Promise<{ path: string; size: number }> {
  const useDirect =
    typeof process.env.NEXT_PUBLIC_USE_DIRECT_PDF_UPLOAD === "string" &&
    process.env.NEXT_PUBLIC_USE_DIRECT_PDF_UPLOAD === "1";

  if (useDirect) {
    const signRes = await fetch("/api/admin/books/signed-upload-url", {
      method: "POST",
      credentials: "include",
    });
    const signJson = (await signRes.json()) as {
      signedUrl?: string;
      path?: string;
      error?: string;
    };
    if (!signRes.ok || !signJson.signedUrl || !signJson.path) {
      throw new Error(signJson.error ?? "Could not start direct upload");
    }
    onProgress(5);
    const putRes = await fetch(signJson.signedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": "application/pdf",
      },
    });
    if (!putRes.ok) {
      const t = await putRes.text();
      throw new Error(
        t.slice(0, 200) || `Direct upload failed (${putRes.status})`,
      );
    }
    onProgress(100);
    return { path: signJson.path, size: file.size };
  }

  const fd = new FormData();
  fd.set("file", file);

  return new Promise<{ path: string; size: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as {
          path?: string;
          size?: number;
          error?: string;
        };
        if (xhr.status >= 200 && xhr.status < 300 && body.path) {
          resolve({ path: body.path, size: body.size ?? file.size });
        } else {
          reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error("Invalid upload response"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.open("POST", "/api/admin/books/upload-pdf");
    xhr.withCredentials = true;
    xhr.send(fd);
  });
}

export function AddBookModal({ children }: AddBookModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [isbn, setIsbn] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [noOfChapters, setNoOfChapters] = useState<string>("");
  const [chapterFiles, setChapterFiles] = useState<(File | null)[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);

  const { data: subjects = [] } = useQuery(
    trpc.subjects.listActive.queryOptions(),
  );
  const { data: classesData } = useQuery(
    trpc.classes.getMany.queryOptions({
      page: 1,
      pageSize: 50,
      search: "",
      classNumber: null,
      isActive: null,
    }),
  );
  const classes = classesData?.items ?? [];

  const createBookMulti = useMutation(
    trpc.books.createWithChapterPdfs.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.books.list.queryOptions());
        toast.success("Book added — processing started for each chapter");
        setOpen(false);
        resetForm();
      },
      onError: (e) => {
        toast.error(e.message);
        setUploadPct(null);
        setUploadLabel(null);
      },
    }),
  );

  const resetForm = useCallback(() => {
    setStep(1);
    setTitle("");
    setDescription("");
    setAuthor("");
    setPublisher("");
    setIsbn("");
    setSubjectId("");
    setClassId("");
    setNoOfChapters("");
    setChapterFiles([]);
    setUploadPct(null);
    setUploadLabel(null);
  }, []);

  const nChapters = Math.min(100, Math.max(0, parseInt(noOfChapters, 10) || 0));

  useEffect(() => {
    if (step !== 2 || nChapters < 1) return;
    setChapterFiles((prev) => {
      const next = [...prev];
      if (next.length === nChapters) return prev;
      if (next.length < nChapters) {
        while (next.length < nChapters) next.push(null);
        return next;
      }
      return next.slice(0, nChapters);
    });
  }, [step, nChapters]);

  const allChaptersHaveFiles =
    nChapters >= 1 &&
    chapterFiles.length === nChapters &&
    chapterFiles.every((f) => f instanceof File);

  const goNext = () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!subjectId) {
      toast.error("Select a subject");
      return;
    }
    if (!classId) {
      toast.error("Select a class");
      return;
    }
    if (!Number.isFinite(nChapters) || nChapters < 1 || nChapters > 100) {
      toast.error("Number of chapters must be between 1 and 100");
      return;
    }
    setChapterFiles(Array.from({ length: nChapters }, () => null));
    setStep(2);
  };

  const onSubmit = async () => {
    if (!allChaptersHaveFiles) {
      toast.error("Attach a PDF for every chapter");
      return;
    }

    setUploadPct(0);
    const chapterPdfs: {
      chapterNumber: number;
      supabaseStorageUrl: string;
      pdfSize: number;
    }[] = [];

    try {
      for (let i = 0; i < nChapters; i++) {
        const file = chapterFiles[i]!;
        setUploadLabel(`Uploading chapter ${i + 1} of ${nChapters}…`);
        setUploadPct(Math.round((i / nChapters) * 90));
        const { path, size } = await uploadPdfFile(file, (p) => {
          if (p !== null) {
            setUploadPct(
              Math.round((i / nChapters) * 90 + (p / 100) * (90 / nChapters)),
            );
          }
        });
        chapterPdfs.push({
          chapterNumber: i + 1,
          supabaseStorageUrl: path,
          pdfSize: size,
        });
      }
      setUploadPct(95);
      setUploadLabel("Creating book…");
      createBookMulti.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        author: author.trim() || undefined,
        publisher: publisher.trim() || undefined,
        isbn: isbn.trim() || undefined,
        subjectId,
        classId,
        noOfChapters: nChapters,
        chapterPdfs,
      });
      setUploadPct(100);
    } catch (e) {
      setUploadPct(null);
      setUploadLabel(null);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const busy =
    createBookMulti.isPending || (uploadPct !== null && uploadPct < 100);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-violet-600 hover:bg-violet-700">
            Add New Book
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,900px)] flex-col gap-0 overflow-hidden sm:max-w-[700px]">
        <DialogHeader className="shrink-0 space-y-2 pb-2">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-2xl font-bold">
              Add New Book
            </DialogTitle>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              Step {step} of 2
            </span>
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="bg-violet-500 transition-all duration-300"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>
          <DialogDescription className="text-base pt-1">
            {step === 1
              ? "Enter book details and how many chapters you will upload (one PDF per chapter)."
              : `Upload exactly ${nChapters} PDF file(s) — Chapter 1 through Chapter ${nChapters}. Each file is processed separately with the correct chapter number.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">
          {step === 1 ? (
            <div className="grid gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="book-title" className="font-semibold">
                    Book Title
                  </Label>
                  <Input
                    id="book-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. NCERT Science — Class X"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="no-chapters" className="font-semibold">
                    Number of chapters{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="no-chapters"
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    value={noOfChapters}
                    onChange={(e) => setNoOfChapters(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="book-author" className="font-semibold">
                    Author
                  </Label>
                  <Input
                    id="book-author"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold">Subject</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-desc" className="font-semibold">
                  Description
                </Label>
                <Textarea
                  id="book-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description"
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-semibold">Class</Label>
                  <Select value={classId} onValueChange={setClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="book-isbn" className="font-semibold">
                    ISBN
                  </Label>
                  <Input
                    id="book-isbn"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="book-publisher" className="font-semibold">
                  Publisher
                </Label>
                <Input
                  id="book-publisher"
                  value={publisher}
                  onChange={(e) => setPublisher(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>
          ) : (
            <div className="flex max-h-[min(52vh,420px)] flex-col gap-4 overflow-y-auto pr-1">
              <div className="flex items-center gap-2 rounded-xl border border-muted-foreground/20 bg-muted/30 p-3">
                <FileText className="h-5 w-5 shrink-0 text-violet-600" />
                <p className="text-sm text-muted-foreground">
                  Use one PDF per chapter (split the full textbook beforehand).
                  With{" "}
                  <code className="rounded bg-muted px-1 text-xs">
                    NEXT_PUBLIC_USE_DIRECT_PDF_UPLOAD=1
                  </code>{" "}
                  uploads go directly to storage.
                </p>
              </div>
              {Array.from({ length: nChapters }, (_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-3 shadow-sm"
                >
                  <Label className="mb-2 block text-sm font-semibold">
                    Chapter {i + 1}
                  </Label>
                  <label className="flex cursor-pointer items-center justify-between rounded-md border bg-background px-3 py-2 transition-colors hover:bg-muted/50">
                    <span className="text-sm text-muted-foreground truncate pr-2">
                      {chapterFiles[i]
                        ? chapterFiles[i]!.name
                        : "Choose PDF (required)"}
                    </span>
                    <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setChapterFiles((prev) => {
                          const next = [...prev];
                          next[i] = f;
                          return next;
                        });
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {uploadLabel ? (
          <p className="shrink-0 text-xs text-muted-foreground">
            {uploadLabel}
          </p>
        ) : null}
        {uploadPct !== null ? (
          <p className="shrink-0 text-xs text-muted-foreground">
            Progress… {uploadPct}%
          </p>
        ) : null}

        <DialogFooter className="mt-2 shrink-0 flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {step === 2 ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setStep(1);
                  setUploadPct(null);
                  setUploadLabel(null);
                }}
              >
                Back
              </Button>
            ) : null}
            <Button
              variant="outline"
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
          <div>
            {step === 1 ? (
              <Button
                type="button"
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm hover:from-violet-600 hover:to-fuchsia-600"
                disabled={busy}
                onClick={goNext}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-sm hover:from-violet-600 hover:to-fuchsia-600"
                disabled={busy || !allChaptersHaveFiles}
                onClick={() => void onSubmit()}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Working…
                  </>
                ) : (
                  "Add book & process"
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
