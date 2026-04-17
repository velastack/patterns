import { error, fail } from "@sveltejs/kit";
import { redirect } from "sveltekit-flash-message/server";
import { zod4 } from "sveltekit-superforms/adapters";
import { superValidate } from "sveltekit-superforms";
import { teamSchema } from "$lib/schemas/team";
import { setPocketbaseErrors } from "@velastack/pocketbase";

export const actions = {
  updateTeam: async ({ locals, params, request, cookies }) => {
    const form = await superValidate(request, zod4(teamSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    try {
      await locals.pb
        .collection("teams")
        .update(params.id, { name: form.data.name });
    } catch (error) {
      setPocketbaseErrors(form, error);
      return fail(400, { form });
    }

    redirect(
      303,
      `/teams/${params.id}`,
      { type: "toast", message: "Team updated" },
      cookies,
    );
  },
  removeMember: async ({ locals, params, request, cookies }) => {
    const formData = await request.formData();
    const memberId = formData.get("member_id") as string;
    if (!memberId) {
      return error(400, { message: "Member ID is required" });
    }

    try {
      await locals.pb.collection("team_memberships").delete(memberId);
    } catch {
      return error(400, { message: "Failed to remove member" });
    }

    redirect(
      303,
      `/teams/${params.id}`,
      { type: "toast", message: "Member removed" },
      cookies,
    );
  },
  resendInvite: async ({ locals }) => {
    const user = locals.pb.authStore.record!;
  },
  cancelInvite: async ({ locals, params, request, cookies }) => {
    const formData = await request.formData();
    const inviteId = formData.get("invite_id") as string;
    if (!inviteId) {
      return error(400, { message: "Invite ID is required" });
    }

    try {
      await locals.pb.collection("team_invites").delete(inviteId);
    } catch {
      return error(400, { message: "Failed to cancel invite" });
    }

    redirect(
      303,
      `/teams/${params.id}`,
      { type: "toast", message: "Invite cancelled" },
      cookies,
    );
  },
  deleteTeam: async ({ locals, params, cookies }) => {
    try {
      await locals.pb.collection("teams").delete(params.id);
    } catch {
      return error(400, { message: "Failed to delete team" });
    }

    const team = cookies.get("team");
    if (team === params.id) {
      cookies.delete("team", { path: "/" });
    }

    redirect(
      303,
      `/teams`,
      { type: "toast", message: "Team deleted successfully" },
      cookies,
    );
  },
};
