import { z } from 'zod/v3';

export const otpSchema = z.object({
	otp: z.string()
});
