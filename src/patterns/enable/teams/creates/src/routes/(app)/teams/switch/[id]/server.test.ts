import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Match } from '@velastack/pocketbase';
import type { RouteId } from './$types';

let team: { id: string; name: string; owner: string };

beforeEach(async (context) => {
	await context.agent.authenticateUser();

	// Create a test team for the user
	const teamName = `Test Team ${Math.random().toString(36).slice(2)}`;
	team = await context.admin.collection('teams').create({
		name: teamName,
		owner: context.user.id
	});

	// Create team membership
	await context.admin.collection('team_memberships').create({
		user: context.user.id,
		team: team.id,
		role: 'owner'
	});
});

afterEach(async (context) => {
	try {
		await context.admin.collection('teams').delete(team.id);
	} catch {}
});

describe('GET /teams/switch/[id]', () => {
	it('should set team cookie and redirect to dashboard for valid team', async (context) => {
		const response = await context.agent.get(`/teams/switch/${team.id}` satisfies Match<RouteId>);

		expect(response.status).toBe(303);
		expect(response.headers.location).toBe('/dashboard');

		// Check that the team cookie is set
		const cookies = response.headers['set-cookie']?.[0];
		expect(cookies).toBeDefined();
		expect(cookies).toContain(`team=${team.id}`);
	});

	it('should redirect to custom redirect URL when provided', async (context) => {
		const customRedirect = '/teams';
		const response = await context.agent.get(
			`/teams/switch/${team.id}?redirect=${encodeURIComponent(customRedirect)}` satisfies Match<RouteId>
		);

		expect(response.status).toBe(303);
		expect(response.headers.location).toBe(customRedirect);

		// Check that the team cookie is still set
		const cookies = response.headers['set-cookie']?.[0];
		expect(cookies).toBeDefined();
		expect(cookies).toContain('team=' + team.id);
	});

	it('should return 404 error for non-existent team', async (context) => {
		const nonExistentTeamId = 'non-existent-team-id';
		const response = await context.agent.get(
			`/teams/switch/${nonExistentTeamId}` satisfies Match<RouteId>
		);

		expect(response.status).toBe(404);

		const cookies = response.headers['set-cookie']?.[0];
		expect(cookies).toBeUndefined();
	});

	it('should return 404 error for invalid team ID format', async (context) => {
		const invalidTeamId = 'invalid-id-format';
		const response = await context.agent.get(
			`/teams/switch/${invalidTeamId}` satisfies Match<RouteId>
		);

		expect(response.status).toBe(404);

		// Check that no team cookie is set
		const cookies = response.headers['set-cookie']?.[0];
		expect(cookies).toBeUndefined();
	});
});
