export const load = async ({ locals, parent }) => {
	const { user, breadcrumbs } = await parent();

	const ownedTeams = await locals.pb.collection('teams').getFullList({
		filter: locals.pb.filter('owner = {:owner}', { owner: user.id }),
		expand: 'team_users_via_team'
	});

	const memberships = await locals.pb.collection('team_memberships').getFullList({
		filter: locals.pb.filter('user = {:user}', { user: user.id }),
		expand: 'team'
	});

	const pendingInvites = await locals.pb.collection('team_invites').getFullList({
		filter: locals.pb.filter('email = {:email}', { email: user.email }),
		expand: 'team'
	});

	const teams = [
		...ownedTeams.map((team) => ({
			type: 'team' as const,
			id: team.id,
			name: team.name,
			role: 'owner' as const,
			members: team.expand?.team_users_via_team?.length || 0
		})),
		...memberships
			.filter((membership) => membership.expand?.team.owner !== membership.user)
			.map((membership) => ({
				type: 'membership' as const,
				id: membership.team,
				name: membership.expand?.team.name,
				role: membership.role
			})),
		...pendingInvites.map((invite) => ({
			type: 'invite' as const,
			id: invite.team,
			name: invite.expand?.team.name,
			role: null,
			invite_id: invite.id
		}))
	];

	return {
		teams,
		breadcrumbs: [...breadcrumbs, { title: 'Teams', url: '/teams' }]
	};
};
