import { z } from "zod";

// Flat, like the login schema, so every field stays addressable in the page.
export const signupSchema = z
  .object({
    type: z.enum(["password", "otp", "whatsapp"]),
    email: z.email().optional(),
    password: z.string().optional(),
    passwordConfirm: z.string().optional(),
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
