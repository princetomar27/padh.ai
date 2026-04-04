"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { createUserSchema } from "../schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { OctagonAlertIcon, BookOpen } from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";

interface OnboardingFormProps {
  onSuccess: (userRole: string) => void;
}

export const OnboardingForm = ({ onSuccess }: OnboardingFormProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clerk hooks
  const { isLoaded, user } = useUser();
  const clerk = useClerk();

  const form = useForm<z.infer<typeof createUserSchema>>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      name: "",
      role: "STUDENT",
      class: undefined,
      school: "",
    },
  });

  const selectedRole = form.watch("role");

  // Pre-fill name from Clerk once loaded
  useEffect(() => {
    if (isLoaded && user?.fullName) {
      form.setValue("name", user.fullName);
    }
  }, [isLoaded, user?.fullName, form]);

  // Clear class/school when role changes away from STUDENT
  useEffect(() => {
    if (selectedRole !== "STUDENT") {
      form.setValue("class", undefined);
      form.setValue("school", "");
    }
  }, [selectedRole, form]);

  const trpc = useTRPC();
  const createUserMutation = useMutation(
    trpc.auth.onboardUser.mutationOptions(),
  );

  const onSubmit = (data: z.infer<typeof createUserSchema>) => {
    setError(null);
    setIsSubmitting(true);
    createUserMutation.mutate(
      {
        name: data.name,
        role: data.role,
        ...(data.role === "STUDENT" && {
          class: data.class,
          school: data.school,
        }),
      },
      {
        onSuccess: async (responseData) => {
          // Step 1: Reload the Clerk user object so the in-memory representation
          // has the new publicMetadata (isOnboarded: true, role).
          await clerk.user?.reload();

          // Step 2: Force a new JWT to be issued and written to the browser cookie.
          // clerkUser.reload() updates the in-memory user but does NOT rotate the
          // session JWT that lives in the cookie. The middleware reads sessionClaims
          // from that cookie — so without this reload(), the very next request from
          // window.location.href will still carry isOnboarded: false.
          await clerk.session?.reload();

          setIsSubmitting(false);
          onSuccess(responseData.role);
        },
        onError: (err) => {
          setError(err.message);
          setIsSubmitting(false);
        },
      },
    );
  };

  // Loading skeleton while Clerk initialises
  if (!isLoaded) {
    return (
      <div className="w-full max-w-md mx-auto">
        <Card className="shadow-lg border-0">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <CardTitle className="text-2xl font-bold">Loading…</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="shadow-lg border-0">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Welcome to padh.ai
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Tell us a bit about yourself so we can personalise your learning
          </p>
        </CardHeader>

        <CardContent className="px-8 pb-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Full Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter your full name"
                        {...field}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Role */}
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>I am a…</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-11">
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STUDENT">
                          Student (Class 9–12)
                        </SelectItem>
                        <SelectItem value="PARENT">Parent</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Class & School — shown only for students */}
              {selectedRole === "STUDENT" && (
                <>
                  <FormField
                    control={form.control}
                    name="class"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Class</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(parseInt(val))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Select your class" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[9, 10, 11, 12].map((n) => (
                              <SelectItem key={n} value={n.toString()}>
                                Class {n}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="school"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>School Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter your school name"
                            {...field}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {error && (
                <Alert className="bg-destructive/10 border-none">
                  <OctagonAlertIcon className="h-4 w-4 !text-destructive" />
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 mt-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </span>
                ) : (
                  "Get Started"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
