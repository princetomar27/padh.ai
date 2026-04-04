import { z } from "zod";

/**
 * Schema for the padh.ai onboarding form.
 *
 * Roles: STUDENT, PARENT, ADMIN (TEACHER removed — padh.ai v1 has no teacher role)
 * Classes: 9–12 only (CBSE; this is what padh.ai covers)
 */
export const createUserSchema = z
  .object({
    name: z.string().min(1, { message: "Name is required" }),
    role: z.enum(["STUDENT", "PARENT", "ADMIN"]),
    // Required only when role = STUDENT
    class: z
      .number()
      .int()
      .min(9, { message: "Classes 9–12 only" })
      .max(12, { message: "Classes 9–12 only" })
      .optional(),
    school: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === "STUDENT") {
        return (
          data.class !== undefined &&
          data.school !== undefined &&
          data.school.trim().length > 0
        );
      }
      return true;
    },
    {
      message: "Class (9–12) and school name are required for students",
      path: ["class"],
    }
  );

export type CreateUserInput = z.infer<typeof createUserSchema>;
