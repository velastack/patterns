import { z } from "zod";

export const teamInviteSchema = z.object({
  email: z.email(),
});
