import { z } from 'zod/v3';

export const teamSchema = z.object({
	name: z.string()
});
