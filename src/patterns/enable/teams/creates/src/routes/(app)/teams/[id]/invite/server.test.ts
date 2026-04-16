import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Match } from '@velastack/pocketbase';
import * as devalue from 'devalue';
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

describe('GET /teams/[id]/invite', () => {
	it('authenticated user should be able to access invite page', async (context) => {
		const response = await context.agent.get(`/teams/${team.id}/invite` satisfies Match<RouteId>);
		expect(response.status).toBe(200);
	});
});

describe('POST /teams/[id]/invite', () => {
	it('owner should be able to create invite with valid email', async (context) => {
		const inviteEmail = `test-${Math.random().toString(36).slice(2)}@example.com`;

		await context.agent
			.post(`/teams/${team.id}/invite` satisfies Match<RouteId>)
			.type('form')
			.send({
				email: inviteEmail
			});

		const invites = await context.admin.collection('team_invites').getList(1, 1, {
			filter: `team = "${team.id}" && email = "${inviteEmail}"`
		});
		expect(invites.items).toHaveLength(1);
		expect(invites.items[0].email).toBe(inviteEmail);
		expect(invites.items[0].team).toBe(team.id);
		expect(invites.items[0].name).toBe(team.name);
	});

	it('admin should be able to create invite with valid email', async (context) => {
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

		const inviteEmail = `test-${Math.random().toString(36).slice(2)}@example.com`;

		await context.agent
			.post(`/teams/${team.id}/invite` satisfies Match<RouteId>)
			.type('form')
			.send({
				email: inviteEmail
			});

		const invites = await context.admin.collection('team_invites').getList(1, 1, {
			filter: `team = "${team.id}" && email = "${inviteEmail}"`
		});
		expect(invites.items).toHaveLength(1);
		expect(invites.items[0].email).toBe(inviteEmail);
		expect(invites.items[0].team).toBe(team.id);
		expect(invites.items[0].name).toBe(team.name);

		context.admin.collection('users').delete(adminUser.id);
	});

	it('member should not be able to create invite', async (context) => {
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
			email,
			password
		});

		const inviteEmail = `test-${Math.random().toString(36).slice(2)}@example.com`;

		await context.agent
			.post(`/teams/${team.id}/invite` satisfies Match<RouteId>)
			.type('form')
			.send({
				email: inviteEmail
			});

		const invites = await context.admin.collection('team_invites').getList(1, 1, {
			filter: `team = "${team.id}" && email = "${inviteEmail}"`
		});
		expect(invites.items).toHaveLength(0);

		context.admin.collection('users').delete(memberUser.id);
	});

	it('should return 400 for invalid email', async (context) => {
		const response = await context.agent
			.post(`/teams/${team.id}/invite` satisfies Match<RouteId>)
			.type('form')
			.send({
				email: 'invalid-email'
			});

		const data = devalue.parse(response.body.data);
		expect(data.form.valid).toBe(false);
	});

	it('should return 400 for missing email', async (context) => {
		const response = await context.agent
			.post(`/teams/${team.id}/invite` satisfies Match<RouteId>)
			.type('form')
			.send({});

		const data = devalue.parse(response.body.data);
		expect(data.form.valid).toBe(false);
	});

	it('should return 400 for empty email', async (context) => {
		const response = await context.agent
			.post(`/teams/${team.id}/invite` satisfies Match<RouteId>)
			.type('form')
			.send({
				email: ''
			});

		const data = devalue.parse(response.body.data);
		expect(data.form.valid).toBe(false);
	});
});
