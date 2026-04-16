import { z } from 'zod/v3';

export const teamRoleSchema = z.object({
	role: z.enum(['owner', 'admin', 'member'])
});
