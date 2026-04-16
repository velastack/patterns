import { describe, it, expect, beforeEach, afterEach, type TestContext } from 'vitest';
import type { Match } from '@velastack/pocketbase';
import type { RouteId } from './$types';

let team: { id: string; name: string };

beforeEach(async (context) => {
	await context.agent.authenticateUser();

	team = await context.admin.collection('teams').create({
		name: 'Test Team',
		owner: context.user.id
	});

	await context.admin.collection('team_memberships').create({
		team: team.id,
		user: context.user.id,
		role: 'owner'
	});
});

afterEach(async (context) => {
	try {
		await context.admin.collection('teams').delete(team.id);
	} catch {}
});

describe('GET /teams/[id]', () => {
	it('authenticated user should be able to access a team page', async (context) => {
		const response = await context.agent.get(`/teams/${team.id}` satisfies Match<RouteId>);
		expect(response.status).toBe(200);
	});
});

describe('POST /teams/[id]?/updateTeam', () => {
	it('owner should be able to update team', async (context) => {
		await context.agent
			.post(`/teams/${team.id}?/updateTeam` satisfies Match<RouteId>)
			.type('form')
			.send({
				name: 'Updated Team Name'
			});

		const updatedTeam = await context.admin.collection('teams').getOne(team.id);
		expect(updatedTeam.name).toBe('Updated Team Name');
	});

	it('admin should not be able to update team', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const password = 'password';

		const adminUser = await context.admin.collection('users').create({
			email,
			password,
			passwordConfirm: password
		});

		await context.admin.collection('team_memberships').create({
			team: team.id,
			user: adminUser.id,
			role: 'admin'
		});

		await context.agent.post('/login').type('form').send({
			type: 'password',
			email,
			password
		});

		await context.agent
			.post(`/teams/${team.id}?/updateTeam` satisfies Match<RouteId>)
			.type('form')
			.send({
				name: 'Updated Team Name'
			});

		const updatedTeam = await context.admin.collection('teams').getOne(team.id);
		expect(updatedTeam.name).not.toBe('Updated Team Name');

		context.admin.collection('users').delete(adminUser.id);
	});
});

describe('POST /teams/[id]?/removeMember', () => {
	it('owner should be able to remove member', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const password = 'password';

		const memberUser = await context.admin.collection('users').create({
			email,
			password,
			passwordConfirm: password
		});

		const member = await context.admin.collection('team_memberships').create({
			team: team.id,
			user: memberUser.id,
			role: 'member'
		});

		await context.agent
			.post(`/teams/${team.id}?/removeMember` satisfies Match<RouteId>)
			.type('form')
			.send({
				member_id: member.id
			});

		await expect(context.admin.collection('team_memberships').getOne(member.id)).rejects.toThrow();

		context.admin.collection('users').delete(memberUser.id);
	});

	it('admin should be able to remove member', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const password = 'password';

		const adminUser = await context.admin.collection('users').create({
			email,
			password,
			passwordConfirm: password
		});

		const memberUser = await context.admin.collection('users').create({
			email: `test-${Math.random().toString(36).slice(2)}@example.com`,
			password,
			passwordConfirm: password
		});

		await context.admin.collection('team_memberships').create({
			team: team.id,
			user: adminUser.id,
			role: 'admin'
		});

		await context.admin.collection('team_memberships').create({
			team: team.id,
			user: memberUser.id,
			role: 'member'
		});

		await context.agent.post('/login').type('form').send({
			type: 'password',
			email: adminUser.email,
			password
		});

		await context.agent
			.post(`/teams/${team.id}?/removeMember` satisfies Match<RouteId>)
			.type('form')
			.send({
				member_id: memberUser.id
			});

		await expect(
			context.admin.collection('team_memberships').getOne(memberUser.id)
		).rejects.toThrow();

		context.admin.collection('users').delete(adminUser.id);
		context.admin.collection('users').delete(memberUser.id);
	});

	it('admin should not be able to remove owner', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const password = 'password';

		const adminUser = await context.admin.collection('users').create({
			email,
			password,
			passwordConfirm: password
		});

		await context.agent.post('/login').type('form').send({
			type: 'password',
			email: adminUser.email,
			password
		});

		await context.agent
			.post(`/teams/${team.id}?/removeMember` satisfies Match<RouteId>)
			.type('form')
			.send({
				member_id: context.user.id
			});

		const teamMembership = await context.admin.collection('team_memberships').getFirstListItem(
			context.pb.filter('team = {:team} && user = {:user}', {
				team: team.id,
				user: context.user.id
			})
		);
		expect(teamMembership.role).toBe('owner');

		context.admin.collection('users').delete(adminUser.id);
	});
});

describe('POST /teams/[id]?/cancelInvite', () => {
	it('owner should be able to cancel invite', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;

		const invite = await context.admin.collection('team_invites').create({
			team: team.id,
			email,
			role: 'member'
		});

		await context.agent
			.post(`/teams/${team.id}?/cancelInvite` satisfies Match<RouteId>)
			.type('form')
			.send({
				invite_id: invite.id
			});

		await expect(context.admin.collection('team_invites').getOne(invite.id)).rejects.toThrow();
	});

	it('admin should be able to cancel invite', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const password = 'password';

		const adminUser = await context.admin.collection('users').create({
			email,
			password,
			passwordConfirm: password
		});

		await context.admin.collection('team_memberships').create({
			team: team.id,
			user: adminUser.id,
			role: 'admin'
		});

		const inviteEmail = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const invite = await context.admin.collection('team_invites').create({
			team: team.id,
			email: inviteEmail,
			role: 'member'
		});

		await context.agent.post('/login').type('form').send({
			type: 'password',
			email: adminUser.email,
			password
		});

		await context.agent
			.post(`/teams/${team.id}?/cancelInvite` satisfies Match<RouteId>)
			.type('form')
			.send({
				invite_id: invite.id
			});

		await expect(context.admin.collection('team_invites').getOne(invite.id)).rejects.toThrow();

		context.admin.collection('users').delete(adminUser.id);
	});

	it('member should not be able to cancel invite', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const password = 'password';

		const memberUser = await context.admin.collection('users').create({
			email,
			password,
			passwordConfirm: password
		});

		await context.admin.collection('team_memberships').create({
			team: team.id,
			user: memberUser.id,
			role: 'member'
		});

		const inviteEmail = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const invite = await context.admin.collection('team_invites').create({
			team: team.id,
			email: inviteEmail,
			role: 'member'
		});

		await context.agent.post('/login').type('form').send({
			type: 'password',
			email: memberUser.email,
			password
		});

		const response = await context.agent
			.post(`/teams/${team.id}?/cancelInvite` satisfies Match<RouteId>)
			.type('form')
			.send({
				invite_id: invite.id
			});

		expect(response.status).toBe(400);

		// Verify invite still exists
		const existingInvite = await context.admin.collection('team_invites').getOne(invite.id);
		expect(existingInvite).toBeDefined();

		context.admin.collection('users').delete(memberUser.id);
	});

	it('should return error for invalid invite ID', async (context) => {
		const response = await context.agent
			.post(`/teams/${team.id}?/cancelInvite` satisfies Match<RouteId>)
			.type('form')
			.send({
				invite_id: 'invalid-id'
			});

		expect(response.status).toBe(400);
	});
});

describe('POST /teams/[id]?/deleteTeam', () => {
	it('owner should be able to delete team', async (context) => {
		await context.agent
			.post(`/teams/${team.id}?/deleteTeam` satisfies Match<RouteId>)
			.type('form')
			.send({});

		await expect(context.admin.collection('teams').getOne(team.id)).rejects.toThrow();
	});

	it('admin should not be able to delete team', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const password = 'password';

		const adminUser = await context.admin.collection('users').create({
			email,
			password,
			passwordConfirm: password
		});

		await context.admin.collection('team_memberships').create({
			team: team.id,
			user: adminUser.id,
			role: 'admin'
		});

		await context.agent.post('/login').type('form').send({
			type: 'password',
			email: adminUser.email,
			password
		});

		const response = await context.agent
			.post(`/teams/${team.id}?/deleteTeam` satisfies Match<RouteId>)
			.type('form')
			.send({});

		expect(response.status).toBe(400);

		// Verify team still exists
		const existingTeam = await context.admin.collection('teams').getOne(team.id);
		expect(existingTeam).toBeDefined();

		context.admin.collection('users').delete(adminUser.id);
	});

	it('member should not be able to delete team', async (context) => {
		const email = `test-${Math.random().toString(36).slice(2)}@example.com`;
		const password = 'password';

		const memberUser = await context.admin.collection('users').create({
			email,
			password,
			passwordConfirm: password
		});

		await context.admin.collection('team_memberships').create({
			team: team.id,
			user: memberUser.id,
			role: 'member'
		});

		await context.agent.post('/login').type('form').send({
			type: 'password',
			email: memberUser.email,
			password
		});

		const response = await context.agent
			.post(`/teams/${team.id}?/deleteTeam` satisfies Match<RouteId>)
			.type('form')
			.send({});

		expect(response.status).toBe(400);

		// Verify team still exists
		const existingTeam = await context.admin.collection('teams').getOne(team.id);
		expect(existingTeam).toBeDefined();

		context.admin.collection('users').delete(memberUser.id);
	});
});
