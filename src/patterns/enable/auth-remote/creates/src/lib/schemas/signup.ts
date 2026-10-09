import { z } from "zod";

// Flat, like the login schema, so every field stays addressable in the page.
export const signupSchema = z
  .object({
    type: z.enum(["password", "otp"]),
    email: z.email(),
    password: z.string().optional(),
    passwordConfirm: z.string().optional(),
  })
  .refine((data) => data.type !== "password" || !!data.password, {
    message: "Password is required",
    path: ["password"],
  });
