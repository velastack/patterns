import { fail, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { confirmEmailChangeSchema } from '$lib/schemas/confirmEmailChange';
import { redirect } from '@sveltejs/kit';
import { setFlash } from 'sveltekit-flash-message/server';

export const load = async () => {
	return { form: await superValidate(zod(confirmEmailChangeSchema)) };
};

export const actions = {
	default: async ({ locals, params, request, cookies }) => {
		const form = await superValidate(request, zod(confirmEmailChangeSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		await locals.admin.collection('users').confirmEmailChange(params.token, form.data.password);

		locals.pb.authStore.clear();
		locals.pb.authStore.clearCookie(cookies);

		setFlash({ type: 'toast', message: 'Email changed successfully.' }, cookies);
		return redirect(303, '/login');
	}
};
