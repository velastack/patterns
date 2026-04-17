import { z } from "zod";

export const confirmEmailChangeSchema = z.object({
  password: z.string(),
});
