import { z } from "zod";

export const confirmResetSchema = z.object({
  password: z.string(),
  passwordConfirm: z.string(),
});
