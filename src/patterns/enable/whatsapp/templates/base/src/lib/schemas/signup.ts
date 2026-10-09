import { z } from "zod";

const passwordSchema = z.object({
  type: z.literal("password"),
  email: z.email(),
  password: z.string(),
  passwordConfirm: z.string(),
});

const otpSchema = z.object({
  type: z.literal("otp"),
  email: z.email(),
});

const whatsappSchema = z.object({
  type: z.literal("whatsapp"),
  phone: z.string().min(1),
});

export const signupSchema = z.discriminatedUnion("type", [
  passwordSchema,
  otpSchema,
  whatsappSchema,
]);
