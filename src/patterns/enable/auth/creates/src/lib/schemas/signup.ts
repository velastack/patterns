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

export const signupSchema = z.discriminatedUnion("type", [
  passwordSchema,
  otpSchema,
]);
