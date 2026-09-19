import { describe, it, expect } from 'vitest';
import type { Match } from '@velastack/kit';
import type { RouteId } from './$types';

// None of these requests reach the model, so they pass without an API key and
// cost nothing.
describe('POST /api/chat', () => {
	it('should return 401 when signed out', async (context) => {
		const response = await context.request.post('/api/chat' satisfies Match<RouteId>).send({
			messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }]
		});

		expect(response.status).toBe(401);
	});

	it('should return 400 if the body is not JSON', async (context) => {
		await context.agent.authenticateUser();

		const response = await context.agent
			.post('/api/chat' satisfies Match<RouteId>)
			.set('Content-Type', 'application/json')
			.send('not json');

		expect(response.status).toBe(400);
	});

	it('should return 400 if messages are missing', async (context) => {
		await context.agent.authenticateUser();

		const response = await context.agent.post('/api/chat' satisfies Match<RouteId>).send({});

		expect(response.status).toBe(400);
	});

	it('should return 400 if messages are malformed', async (context) => {
		await context.agent.authenticateUser();

		const response = await context.agent
			.post('/api/chat' satisfies Match<RouteId>)
			.send({ messages: [{ role: 'user', content: 'Hello' }] });

		expect(response.status).toBe(400);
	});
});
