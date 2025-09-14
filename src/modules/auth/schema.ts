import { z } from "zod";

export const createUserSchema = z
  .object({
    name: z.string().min(1, { message: "Name is required" }),
    role: z.enum(["STUDENT", "PARENT", "TEACHER", "ADMIN"]),
    // class and school are only required when role is student
    class: z.number().optional(),
    school: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.role === "STUDENT") {
        return (
          data.class !== undefined &&
          data.class !== null &&
          data.class >= 1 &&
          data.school !== undefined &&
          data.school !== null &&
          data.school.trim() !== ""
        );
      }
      return true;
    },
    {
      message: "Class and school are required for students",
      path: ["class"],
    }
  );
