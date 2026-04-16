import { z } from 'zod/v3';

export const teamInviteSchema = z.object({
	email: z.string().email()
});
