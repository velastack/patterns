import { z } from 'zod/v3';

const otpSchema = z.object({
	type: z.literal('otp'),
	email: z.string().email()
});

const passwordSchema = z.object({
	type: z.literal('password'),
	email: z.string().email(),
	password: z.string()
});

const oAuth2Schema = z.object({
	type: z.literal('oauth2'),
	email: z.string().email()
});

export const loginSchema = z.discriminatedUnion('type', [otpSchema, passwordSchema, oAuth2Schema]);
