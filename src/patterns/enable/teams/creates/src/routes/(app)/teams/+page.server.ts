import { error, fail } from "@sveltejs/kit";
import { redirect } from "sveltekit-flash-message/server";

export const actions = {
  acceptInvite: async ({ locals, request, cookies }) => {
    const user = locals.pb.authStore.record!;
    const form = await request.formData();
    const inviteId = form.get("invite_id") as string;
    if (!inviteId) {
      return fail(400, { error: "Invite ID is required" });
    }

    let invite;
    try {
      invite = await locals.pb.collection("team_invites").getOne(inviteId);
    } catch {
      return error(404, { message: "Invite not found" });
    }

    await locals.admin.collection("team_memberships").create({
      user: user.id,
      team: invite.team,
      role: "member",
    });

    await locals.admin.collection("team_invites").delete(invite.id);

    redirect(303, `/teams`, { type: "toast", message: "Joined team" }, cookies);
  },
  leaveTeam: async ({ locals, request, cookies }) => {
    const user = locals.pb.authStore.record!;
    const form = await request.formData();
    const teamId = form.get("team_id") as string;
    if (!teamId) {
      return fail(400, { error: "Team ID is required" });
    }

    let teamMembership;
    try {
      teamMembership = await locals.pb
        .collection("team_memberships")
        .getFirstListItem(
          locals.pb.filter("team = {:team} && user = {:user}", {
            team: teamId,
            user: user.id,
          }),
        );
    } catch {
      return error(404, { message: "Team not found" });
    }

    if (teamMembership.role === "owner") {
      return error(400, { message: "You cannot leave a team you own" });
    }

    await locals.pb.collection("team_memberships").delete(teamMembership.id);

    redirect(303, `/teams`, { type: "toast", message: "Left team" }, cookies);
  },
};
