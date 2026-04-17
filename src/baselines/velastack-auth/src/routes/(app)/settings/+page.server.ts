import { superValidate, fail, withFiles } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { setFlash } from 'sveltekit-flash-message/server';
import { profileSchema } from '$lib/schemas/profile';
import { changeEmailSchema } from '$lib/schemas/changeEmail';
import { changePasswordSchema } from '$lib/schemas/changePassword';

export const load = async ({ parent }) => {
	const { user } = await parent();

	const profileForm = await superValidate(
		{
			avatar: user.avatar,
			name: user.name,
			emailVisibility: user.emailVisibility
		},
		zod4(profileSchema)
	);
	const emailForm = await superValidate(zod4(changeEmailSchema));
	const passwordForm = await superValidate(zod4(changePasswordSchema));

	return { profileForm, emailForm, passwordForm, user };
};

export const actions = {
	updateProfile: async ({ locals, request, cookies }) => {
		const form = await superValidate(request, zod4(profileSchema));

		if (!form.valid) {
			return fail(400, { profileForm: form });
		}

		await locals.pb.collection('users').update(locals.pb.authStore.record!.id, form.data);

		setFlash({ type: 'toast', message: 'Profile updated successfully.' }, cookies);
		return withFiles({ profileForm: form });
	},
	changeEmail: async ({ locals, request, cookies }) => {
		const form = await superValidate(request, zod4(changeEmailSchema));

		if (!form.valid) {
			return fail(400, { emailForm: form });
		}

		await locals.pb.collection('users').requestEmailChange(form.data.email);
		setFlash({ type: 'toast', message: 'We sent a confirmation link to your new email.' }, cookies);
		return { emailForm: form };
	},
	changePassword: async ({ locals, request, cookies }) => {
		const form = await superValidate(request, zod4(changePasswordSchema));

		if (!form.valid) {
			return fail(400, { passwordForm: form });
		}

		await locals.admin.collection('users').update(locals.pb.authStore.record!.id, {
			password: form.data.password,
			passwordConfirm: form.data.passwordConfirm
		});

		setFlash({ type: 'toast', message: 'Password updated successfully.' }, cookies);
		return { passwordForm: form };
	},
	resendVerificationEmail: async ({ locals, request, cookies }) => {
		await locals.pb.collection('users').requestVerification(locals.pb.authStore.record!.email);
		setFlash({ type: 'toast', message: 'We sent a verification email to your email.' }, cookies);
		return {};
	}
};
