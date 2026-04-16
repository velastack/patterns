import { z } from "zod/v3";

export const confirmResetSchema = z.object({
  password: z.string(),
  passwordConfirm: z.string(),
});
