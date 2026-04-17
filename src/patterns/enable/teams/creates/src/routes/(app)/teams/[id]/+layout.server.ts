import { redirect } from "@sveltejs/kit";
import { superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { teamSchema } from "$lib/schemas/team";

export const load = async ({ params, locals, parent }) => {
  const { user, breadcrumbs } = await parent();
  const { id } = params;

  let team;
  try {
    team = await locals.pb.collection("teams").getOne(id, {
      expand: "team_invite_links_via_team",
    });
  } catch {
    redirect(303, "/teams");
  }

  let userMembership;
  try {
    userMembership = await locals.pb.collection("team_users").getFirstListItem(
      locals.pb.filter(
        'team = {:team} && id = {:user} && (role = "admin" || role = "owner")',
        {
          team: id,
          user: user.id,
        },
      ),
    );
  } catch (error) {
    redirect(303, "/teams");
  }

  const role = userMembership.role;

  // Get all team members with their roles
  const teamMembers = await locals.pb.collection("team_users").getFullList({
    filter: locals.pb.filter("team = {:team}", { team: id }),
  });

  // Get pending invites for this team
  const pendingInvites = await locals.pb
    .collection("team_invites")
    .getFullList({
      filter: locals.pb.filter("team = {:team}", { team: id }),
    });

  const form = await superValidate(team, zod4(teamSchema));

  return {
    team,
    role,
    teamMembers,
    pendingInvites,
    inviteLink: team.expand?.team_invite_links_via_team,
    form,
    breadcrumbs: [
      ...breadcrumbs,
      { title: "Teams", url: "/teams" },
      { title: team.name, url: `/teams/${id}` },
    ],
  };
};
