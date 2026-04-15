import { z } from 'zod/v3';

export const resetSchema = z.object({
	email: z.string().email()
});
