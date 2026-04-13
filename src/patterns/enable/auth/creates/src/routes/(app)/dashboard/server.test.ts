import { describe, it, expect } from 'vitest';
import type { Match } from '@velastack/pocketbase';
import type { RouteId } from './$types';

describe('dashboard', () => {
	it('should redirect to the login page', async (context) => {
		const response = await context.request.get('/dashboard' satisfies Match<RouteId>);
		expect(response.status).toBe(302);
		expect(response.headers.location).toBe('/login?redirect=%2Fdashboard');
	});

	it('authenticated user should be able to access the dashboard', async (context) => {
		await context.agent.authenticateUser();
		const response = await context.agent.get('/dashboard' satisfies Match<RouteId>);
		expect(response.status).toBe(200);
	});
});
