import { describe, it, expect } from 'vitest';
import type { Match } from '@velastack/pocketbase';
import type { RouteId } from './$types';

describe('GET /reset', () => {
	it('should render the reset page', async (context) => {
		const response = await context.request.get('/reset' satisfies Match<RouteId>);
		expect(response.status).toBe(200);
	});
});

describe('POST /reset', () => {
	it('should request a password reset', async (context) => {
		const response = await context.agent
			.post('/reset' satisfies Match<RouteId>)
			.type('form')
			.send({ email: context.user.email });
		expect(response.body.status).toBe(200);
	});
});
