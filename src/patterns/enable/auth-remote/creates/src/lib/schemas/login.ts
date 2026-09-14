import { z } from "zod";

// A flat shape (rather than a discriminated union) keeps
// `loginForm.fields.password` addressable in the page regardless of mode.
export const loginSchema = z
  .object({
    type: z.enum(["password", "otp", "oauth2"]),
    email: z.email(),
    password: z.string().optional(),
  })
  .refine((data) => data.type !== "password" || !!data.password, {
    message: "Password is required",
    path: ["password"],
  });
