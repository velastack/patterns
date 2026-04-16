import { z } from "zod/v3";

export const confirmEmailChangeSchema = z.object({
  password: z.string(),
});
