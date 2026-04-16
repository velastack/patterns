import { z } from "zod/v3";

export const changeEmailSchema = z.object({
  email: z.string().email(),
});
