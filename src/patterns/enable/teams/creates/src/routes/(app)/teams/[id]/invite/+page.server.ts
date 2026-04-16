import { fail, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { teamInviteSchema } from "$lib/schemas/teamInvite";
import { redirect } from "sveltekit-flash-message/server";
import { setPocketbaseErrors } from "@velastack/pocketbase";

export const load = async () => {
  const form = await superValidate(zod(teamInviteSchema));
  return { form };
};

export const actions = {
  default: async ({ locals, params, request, cookies }) => {
    const form = await superValidate(request, zod(teamInviteSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const team = await locals.pb.collection("teams").getOne(params.id);

    try {
      await locals.pb.collection("team_invites").create({
        email: form.data.email,
        team: params.id,
        name: team.name,
      });
    } catch (error) {
      setPocketbaseErrors(form, error);
      return fail(400, { form });
    }

    redirect(
      `/teams/${params.id}`,
      { type: "toast", message: "Invite sent" },
      cookies,
    );
  },
};
