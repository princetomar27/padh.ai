"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddBookModal } from "@/modules/admin/components/add-book-modal";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Loader2 } from "lucide-react";

export default function AdminBooksView() {
  const trpc = useTRPC();
  const { data: books, isPending } = useQuery(trpc.books.list.queryOptions());

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Books</h1>
          <p className="text-muted-foreground text-sm mt-1">
            NCERT PDFs and processing status. Upload triggers Inngest extraction.
          </p>
        </div>
        <AddBookModal />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Library
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPending && (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading books…
            </div>
          )}
          {!isPending && (!books || books.length === 0) && (
            <p className="text-muted-foreground text-center py-12">
              No books yet. Add your first NCERT PDF.
            </p>
          )}
          {!isPending && books && books.length > 0 && (
            <ul className="divide-y rounded-md border">
              {books.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{b.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.totalPages} pages ·{" "}
                      {b.processingStatus.replaceAll("_", " ").toLowerCase()}
                    </p>
                  </div>
                  <Badge variant="secondary">{b.processingStatus}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
