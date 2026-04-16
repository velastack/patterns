import { fail, superValidate } from "sveltekit-superforms";
import { zod } from "sveltekit-superforms/adapters";
import { teamSchema } from "$lib/schemas/team";
import { redirect } from "sveltekit-flash-message/server";
import { setPocketbaseErrors } from "@velastack/pocketbase";

export const load = async () => {
  const form = await superValidate(zod(teamSchema));
  return { form };
};

export const actions = {
  default: async ({ locals, request, cookies }) => {
    const user = locals.pb.authStore.record!;
    const form = await superValidate(request, zod(teamSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    let team;

    try {
      team = await locals.pb.collection("teams").create({
        name: form.data.name,
        owner: user.id,
      });
    } catch (error) {
      setPocketbaseErrors(form, error);
      return fail(400, { form });
    }

    await locals.admin.collection("team_memberships").create({
      user: user.id,
      team: team.id,
      role: "owner",
    });

    await locals.admin.collection("team_invite_links").create({
      team: team.id,
      name: team.name,
    });

    redirect("/teams", { type: "toast", message: "Team created" }, cookies);
  },
};
