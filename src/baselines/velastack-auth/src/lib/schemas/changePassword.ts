import { z } from 'zod/v3';

export const changePasswordSchema = z
	.object({
		password: z.string(),
		passwordConfirm: z.string()
	})
	.refine((data) => data.password === data.passwordConfirm, {
		message: "Passwords don't match",
		path: ['passwordConfirm']
	});
