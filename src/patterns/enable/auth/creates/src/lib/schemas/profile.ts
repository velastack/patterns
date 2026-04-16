import { z } from "zod/v3";

export const profileSchema = z.object({
  name: z.string().optional(),
  avatar: z.union([z.instanceof(File), z.string()]).optional(),
  emailVisibility: z.boolean().optional(),
});
