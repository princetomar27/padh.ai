import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";

interface RemoveClassDialogProps {
  classId: string;
  className: string;
  classNumber: number;
  studentCount?: number;
  onSuccess?: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

const RemoveClassDialog = ({
  classId,
  className,
  classNumber,
  studentCount = 0,
  onSuccess,
  onLoadingChange,
}: RemoveClassDialogProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const removeClass = useMutation(
    trpc.classes.removeClass.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.classes.getMany.queryOptions({})
        );
        toast.success(
          `Class ${classNumber} "${className}" has been deleted successfully`
        );
        onLoadingChange?.(false);
        onSuccess?.();
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete class");
        onLoadingChange?.(false);
      },
    })
  );

  const handleRemove = () => {
    onLoadingChange?.(true);
    removeClass.mutate({ id: classId });
  };

  const hasStudents = studentCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <div className="cursor-pointer">
          <Trash2 className="h-4 w-4 text-white" />
        </div>
      </AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-left text-lg font-semibold">
                Delete Class
              </AlertDialogTitle>
            </div>
          </div>

          <AlertDialogDescription className="text-left space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="font-medium text-foreground">
                Class {classNumber}: {className}
              </div>
              {studentCount > 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  {studentCount} student{studentCount !== 1 ? "s" : ""} enrolled
                </div>
              )}
            </div>

            {hasStudents ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-medium text-destructive">
                      Cannot delete this class
                    </div>
                    <div className="text-destructive/80 mt-1">
                      This class has {studentCount} enrolled student
                      {studentCount !== 1 ? "s" : ""}. Please move or remove all
                      students before deleting the class.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Are you sure you want to delete this class? This action cannot
                be undone.
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="mt-0 sm:mt-0">Cancel</AlertDialogCancel>
          {!hasStudents && (
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removeClass.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeClass.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Class
                </>
              )}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RemoveClassDialog;
