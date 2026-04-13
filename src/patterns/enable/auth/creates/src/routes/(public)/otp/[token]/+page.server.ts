import { fail, message, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { otpSchema } from '$lib/schemas/otp';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';

export const load = async ({ locals }) => {
	if (locals.pb.authStore.isValid) {
		redirect(303, '/dashboard');
	}

	return { form: await superValidate(zod(otpSchema)) };
};

export const actions = {
	default: async ({ locals, request, params, cookies, url }) => {
		const form = await superValidate(request, zod(otpSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await locals.pb.collection('users').authWithOTP(params.token, form.data.otp);
		} catch (error: any) {
			return message(form, { type: 'error', text: error.response.message }, { status: 400 });
		}

		const redirectUrl = url.searchParams.get('redirect') ?? '/dashboard';
		const cookie = locals.pb.authStore.getCookie();
		cookies.set('pb_auth', cookie, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: !dev,
			maxAge: 60 * 60 * 24 * 30
		});

		redirect(303, redirectUrl);
	}
};
