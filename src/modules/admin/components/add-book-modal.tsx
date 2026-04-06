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
import { useCallback, useState } from "react";
import { toast } from "sonner";

type AddBookModalProps = {
  children?: React.ReactNode;
};

export function AddBookModal({ children }: AddBookModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [author, setAuthor] = useState("");
  const [publisher, setPublisher] = useState("");
  const [isbn, setIsbn] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

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

  const createBook = useMutation(
    trpc.books.create.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.books.list.queryOptions());
        toast.success("Book added — processing started");
        setOpen(false);
        resetForm();
      },
      onError: (e) => {
        toast.error(e.message);
        setUploadPct(null);
      },
    }),
  );

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setAuthor("");
    setPublisher("");
    setIsbn("");
    setSubjectId("");
    setClassId("");
    setFile(null);
    setUploadPct(null);
  }, []);

  const onSubmit = async () => {
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
    if (!file) {
      toast.error("Choose a PDF file");
      return;
    }

    const useDirect =
      typeof process.env.NEXT_PUBLIC_USE_DIRECT_PDF_UPLOAD === "string" &&
      process.env.NEXT_PUBLIC_USE_DIRECT_PDF_UPLOAD === "1";

    setUploadPct(0);

    const uploadPromise = async (): Promise<{ path: string; size: number }> => {
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
        setUploadPct(5);
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
        setUploadPct(100);
        return { path: signJson.path, size: file.size };
      }

      const fd = new FormData();
      fd.set("file", file);

      return new Promise<{ path: string; size: number }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadPct(Math.round((ev.loaded / ev.total) * 100));
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
    };

    try {
      const { path, size } = await uploadPromise();
      setUploadPct(100);
      createBook.mutate({
        title: title.trim(),
        description: description.trim() || undefined,
        author: author.trim() || undefined,
        publisher: publisher.trim() || undefined,
        isbn: isbn.trim() || undefined,
        subjectId,
        classId,
        supabaseStorageUrl: path,
        pdfSize: size,
      });
    } catch (e) {
      setUploadPct(null);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const busy = createBook.isPending || uploadPct !== null;

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
      <DialogContent className="sm:max-w-[700px] gap-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Add New Book</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Upload a PDF to Supabase storage, then we queue Inngest to extract
            chapters and chunks. With{" "}
            <code className="text-xs bg-muted px-1 rounded">
              NEXT_PUBLIC_USE_DIRECT_PDF_UPLOAD=1
            </code>{" "}
            the browser uploads directly to storage (skips the API body limit).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="bg-muted/30 border border-muted-foreground/20 rounded-xl p-4 flex flex-col space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              <span className="font-semibold text-sm">
                Step 1: Upload Book PDF
              </span>
            </div>
            <label className="flex items-center justify-between border rounded-md px-3 py-2 bg-background cursor-pointer hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium">Choose PDF</span>
              <span className="text-sm text-muted-foreground mr-auto ml-4 truncate max-w-[280px]">
                {file ? file.name : "No file chosen"}
              </span>
              <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setFile(f ?? null);
                }}
              />
            </label>
            {uploadPct !== null && (
              <p className="text-xs text-muted-foreground">
                Uploading… {uploadPct}%
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="book-title" className="font-semibold">
                Book Title
              </Label>
              <Input
                id="book-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Science — Class X"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
        </div>

        <DialogFooter className="sm:justify-end gap-2 mt-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0 shadow-sm"
            disabled={busy}
            onClick={() => void onSubmit()}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Working…
              </>
            ) : (
              "Add Book"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
