"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, GraduationCap, BookOpen } from "lucide-react";
import { classesInsertSchema } from "../schemas";
import { getClassDescription, getClassLevel, ClassLevel } from "../types";
import { useTRPC } from "@/trpc/client";
import { toast } from "sonner";
import { z } from "zod";

interface NewClassDialogProps {
  children?: React.ReactNode;
  onSuccess?: (id?: string) => void;
  initialValues?: z.infer<typeof classesInsertSchema> & { id?: string };
}

const classLevelInfo = {
  [ClassLevel.PRIMARY]: {
    label: "Primary Education",
    description: "Classes 1-5: Foundation learning",
    color: "bg-blue-100 text-blue-800",
    icon: "🎯",
  },
  [ClassLevel.UPPER_PRIMARY]: {
    label: "Upper Primary",
    description: "Classes 6-8: Intermediate concepts",
    color: "bg-green-100 text-green-800",
    icon: "📚",
  },
  [ClassLevel.SECONDARY]: {
    label: "Secondary Education",
    description: "Classes 9-10: Board preparation",
    color: "bg-orange-100 text-orange-800",
    icon: "🎓",
  },
  [ClassLevel.HIGHER_SECONDARY]: {
    label: "Higher Secondary",
    description: "Classes 11-12: Specialization",
    color: "bg-purple-100 text-purple-800",
    icon: "🏆",
  },
};

export const NewClassDialog = ({
  children,
  onSuccess,
  initialValues,
}: NewClassDialogProps) => {
  const [open, setOpen] = useState(false);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  // Auto-open dialog when initialValues are provided (edit mode)
  useEffect(() => {
    if (initialValues?.id) {
      setOpen(true);
    }
  }, [initialValues?.id]);

  const createClass = useMutation(
    trpc.classes.createClass.mutationOptions({
      onSuccess: async (data) => {
        await queryClient.invalidateQueries(
          trpc.classes.getMany.queryOptions({})
        );
        onSuccess?.(data.id);
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
        if (error.data?.code === "FORBIDDEN") {
          router.push("/classes");
        }
      },
    })
  );

  const updateClass = useMutation(
    trpc.classes.updateClass.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(
          trpc.classes.getMany.queryOptions({})
        );
        if (initialValues?.id) {
          await queryClient.invalidateQueries(
            trpc.classes.getOne.queryOptions({ id: initialValues.id })
          );
        }
        onSuccess?.();
        setOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const form = useForm<z.infer<typeof classesInsertSchema>>({
    resolver: zodResolver(classesInsertSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      number: initialValues?.number ?? undefined,
      isActive: initialValues?.isActive ?? true,
      description: initialValues?.description ?? "",
    },
  });

  const isEdit = !!initialValues?.id;
  const isPending = createClass.isPending || updateClass.isPending;

  const watchedNumber = form.watch("number");
  const classLevel = watchedNumber ? getClassLevel(watchedNumber) : null;
  const suggestedDescription = watchedNumber
    ? getClassDescription(watchedNumber)
    : "";

  const handleClassNumberChange = (value: string) => {
    const number = parseInt(value);
    if (number >= 1 && number <= 12) {
      form.setValue("number", number);
      if (!form.getValues("description")) {
        form.setValue("description", getClassDescription(number));
      }
      if (!form.getValues("name")) {
        form.setValue("name", `Class ${number}`);
      }
    }
  };

  const onSubmit = (values: z.infer<typeof classesInsertSchema>) => {
    if (isEdit) {
      updateClass.mutate({ ...values, id: initialValues.id! });
    } else {
      createClass.mutate(values);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        setOpen(newOpen);
        // If closing and we're in edit mode, clear the initial values
        if (!newOpen && initialValues?.id) {
          onSuccess?.();
        }
      }}
    >
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-purple-600 hover:bg-purple-700">
            <Plus className="mr-2 h-4 w-4" />
            {isEdit ? "Edit Class" : "Add New Class"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader className="space-y-3 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="h-5 w-5 text-purple-600" />
            {isEdit ? "Edit Class" : "Create New Class"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of this class"
              : "Add a new educational class to the system"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Class Number */}
              <FormField
                control={form.control}
                name="number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Number</FormLabel>
                    <Select
                      onValueChange={handleClassNumberChange}
                      value={field.value?.toString() || ""}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select class number (1-12)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(
                          (num) => {
                            const level = getClassLevel(num);
                            const levelInfo = classLevelInfo[level];
                            return (
                              <SelectItem key={num} value={num.toString()}>
                                <div className="flex items-center justify-between w-full">
                                  <span>Class {num}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`ml-2 text-xs ${levelInfo.color}`}
                                  >
                                    {levelInfo.icon} {levelInfo.label}
                                  </Badge>
                                </div>
                              </SelectItem>
                            );
                          }
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose the class number (1-12 for CBSE curriculum)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Level Info */}
              {classLevel && (
                <div
                  className={`p-4 rounded-lg border ${classLevelInfo[classLevel].color} bg-opacity-20`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">
                      {classLevelInfo[classLevel].icon}
                    </span>
                    <h4 className="font-medium">
                      {classLevelInfo[classLevel].label}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {classLevelInfo[classLevel].description}
                  </p>
                </div>
              )}

              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Class 12" {...field} />
                    </FormControl>
                    <FormDescription>
                      Display name for the class (auto-filled based on number)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={
                          suggestedDescription || "Describe this class..."
                        }
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Brief description of the class and its curriculum
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Preview */}
              {watchedNumber && (
                <div className="p-4 bg-muted/50 rounded-lg border-2 border-dashed">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Class Preview
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Class Number:
                      </span>
                      <span className="font-medium">{watchedNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Education Level:
                      </span>
                      <Badge
                        variant="outline"
                        className={classLevelInfo[classLevel!].color}
                      >
                        {classLevelInfo[classLevel!].label}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant="default">Active</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isPending
                    ? isEdit
                      ? "Updating..."
                      : "Creating..."
                    : isEdit
                    ? "Update Class"
                    : "Create Class"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};
