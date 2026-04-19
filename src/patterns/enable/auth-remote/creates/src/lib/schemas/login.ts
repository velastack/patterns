import { z } from "zod";

const otpSchema = z.object({
  type: z.literal("otp"),
  email: z.email(),
});

const passwordSchema = z.object({
  type: z.literal("password"),
  email: z.email(),
  password: z.string(),
});

const oAuth2Schema = z.object({
  type: z.literal("oauth2"),
  email: z.email(),
});

export const loginSchema = z.discriminatedUnion("type", [
  otpSchema,
  passwordSchema,
  oAuth2Schema,
]);
