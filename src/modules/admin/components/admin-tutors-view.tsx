"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Pencil, Sprout } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] as const;

export function AdminTutorsView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editInstructions, setEditInstructions] = useState("");
  const [editVoice, setEditVoice] = useState<string>("nova");

  const list = useQuery(trpc.agents.listTutors.queryOptions());

  const seed = useMutation(
    trpc.agents.seedMissingTutors.mutationOptions({
      onSuccess: (r) => {
        toast.success(`Seeded ${r.created} new tutor(s)`);
        void queryClient.invalidateQueries(
          trpc.agents.listTutors.queryOptions(),
        );
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const updateTutor = useMutation(
    trpc.agents.updateTutor.mutationOptions({
      onSuccess: () => {
        toast.success("Tutor updated");
        setEditId(null);
        void queryClient.invalidateQueries(
          trpc.agents.listTutors.queryOptions(),
        );
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const editing = list.data?.find((t) => t.id === editId);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bot className="h-7 w-7 text-violet-600" />
            AI tutors
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            One tutor per subject and class (OpenAI Realtime). Seed missing rows
            after adding books; tune instructions and voice per cohort.
          </p>
        </div>
        <Button
          type="button"
          disabled={seed.isPending}
          onClick={() => seed.mutate()}
          className="gap-2"
        >
          {seed.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sprout className="h-4 w-4" />
          )}
          Seed missing tutors
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tutor agents</CardTitle>
          <CardDescription>
            Active TUTOR role agents used for chapter voice sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.isPending ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : list.error ? (
            <p className="text-destructive text-sm">{list.error.message}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Voice</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(list.data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.subjectName}</TableCell>
                    <TableCell>{row.className}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.voiceId}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          setEditId(row.id);
                          setEditName(row.name);
                          setEditInstructions(row.instructions);
                          setEditVoice(row.voiceId);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editId != null} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit tutor</DialogTitle>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="tutor-name">Name</Label>
                <Input
                  id="tutor-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Voice (OpenAI Realtime)</Label>
                <Select value={editVoice} onValueChange={setEditVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tutor-inst">Instructions</Label>
                <Textarea
                  id="tutor-inst"
                  className="min-h-[200px] font-mono text-xs"
                  value={editInstructions}
                  onChange={(e) => setEditInstructions(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editId || updateTutor.isPending}
              onClick={() => {
                if (!editId) return;
                updateTutor.mutate({
                  id: editId,
                  name: editName.trim(),
                  instructions: editInstructions,
                  voiceId: editVoice as (typeof VOICES)[number],
                });
              }}
            >
              {updateTutor.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
