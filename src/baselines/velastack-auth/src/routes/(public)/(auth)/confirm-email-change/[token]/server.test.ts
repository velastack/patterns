import { describe, it, expect } from 'vitest';
import type { Match } from '@velastack/pocketbase';
import type { RouteId } from './$types';

describe('GET /confirm-email-change/[token]', () => {
	it('should render the confirm-email-change page', async (context) => {
		const response = await context.request.get(
			'/confirm-email-change/123456' satisfies Match<RouteId>
		);
		expect(response.status).toBe(200);
	});
});
