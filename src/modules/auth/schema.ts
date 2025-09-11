import { z } from "zod";

export const createUserSchema = z
  .object({
    name: z.string().min(1, { message: "Name is required" }),
    role: z.enum(["STUDENT", "PARENT", "TEACHER", "ADMIN"]),
    //   class is only required user role is student
    class: z.number().min(1, { message: "Class is required" }).optional(),
    school: z.string().min(1, { message: "School is required" }).optional(),
  })
  .refine(
    (data) => {
      if (data.role === "STUDENT") {
        return (
          data.class !== undefined &&
          data.class !== null &&
          data.school !== undefined &&
          data.school !== null
        );
      }
      return true;
    },
    {
      message: "Class and school are required for students",
      path: ["class"],
    }
  );
