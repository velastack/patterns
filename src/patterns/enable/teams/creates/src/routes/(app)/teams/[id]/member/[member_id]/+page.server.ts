import { fail, superValidate } from 'sveltekit-superforms';
import { zod } from 'sveltekit-superforms/adapters';
import { teamRoleSchema } from '$lib/schemas/teamRole';
import { redirect } from 'sveltekit-flash-message/server';
import { setPocketbaseErrors } from '@velastack/pocketbase';

export const load = async ({ locals, params }) => {
	const member = await locals.pb.collection('team_memberships').getOne(params.member_id);
	const form = await superValidate(member, zod(teamRoleSchema));

	return { form };
};

export const actions = {
	default: async ({ locals, params, request, cookies }) => {
		const form = await superValidate(request, zod(teamRoleSchema));

		if (!form.valid) {
			return fail(400, { form });
		}

		try {
			await locals.pb.collection('team_memberships').update(params.member_id, {
				role: form.data.role
			});
		} catch (error) {
			setPocketbaseErrors(form, error);
			return fail(400, { form });
		}

		redirect(
			`/teams/${params.id}`,
			{ type: 'toast', message: 'Role updated successfully' },
			cookies
		);
	}
};
