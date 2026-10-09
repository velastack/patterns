import { z } from "zod";

// A flat shape (rather than a discriminated union) keeps
// `loginForm.fields.password` addressable in the page regardless of mode.
export const loginSchema = z
  .object({
    type: z.enum(["password", "otp", "oauth2", "whatsapp"]),
    email: z.email().optional(),
    password: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine((data) => data.type === "whatsapp" || !!data.email, {
    message: "Email is required",
    path: ["email"],
  })
  .refine((data) => data.type !== "password" || !!data.password, {
    message: "Password is required",
    path: ["password"],
  })
  .refine((data) => data.type !== "whatsapp" || !!data.phone, {
    message: "WhatsApp number is required",
    path: ["phone"],
  });
