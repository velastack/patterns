import { z } from "zod";

export const teamRoleSchema = z.object({
  role: z.enum(["owner", "admin", "member"]),
});
