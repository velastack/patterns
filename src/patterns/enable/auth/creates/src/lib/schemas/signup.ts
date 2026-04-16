import { z } from "zod/v3";

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  passwordConfirm: z.string(),
});
