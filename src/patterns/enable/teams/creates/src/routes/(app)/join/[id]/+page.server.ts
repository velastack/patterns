import { error } from "@sveltejs/kit";
import { redirect } from "sveltekit-flash-message/server";

export const load = async ({ params, locals }) => {
  let invite;
  try {
    invite = await locals.pb.collection("team_invite_links").getOne(params.id, {
      expand: "team",
    });
  } catch {
    return error(404, { message: "Invite link not found" });
  }

  return { invite };
};

export const actions = {
  default: async ({ locals, params, cookies }) => {
    const user = locals.pb.authStore.record!;

    let invite;
    try {
      invite = await locals.pb
        .collection("team_invite_links")
        .getOne(params.id, {
          expand: "team",
        });
    } catch {
      return error(404, { message: "Invite link not found" });
    }

    await locals.admin.collection("team_memberships").create({
      user: user.id,
      team: invite.team,
      role: "member",
    });

    redirect(
      303,
      `/dashboard`,
      { type: "toast", message: "Joined team" },
      cookies,
    );
  },
};
