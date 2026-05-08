import { describe, it, expect } from 'vitest';
import type { Match } from '@velastack/pocketbase';
import * as devalue from 'devalue';
import type { RouteId } from './$types';

describe('GET /signup', () => {
	it('should render the signup page', async (context) => {
		const response = await context.request.get('/signup' satisfies Match<RouteId>);
		expect(response.status).toBe(200);
	});
});

describe('POST /signup', () => {
	it('should signup with password', async (context) => {
		const response = await context.agent
			.post('/signup' satisfies Match<RouteId>)
			.type('form')
			.send({
				email: `test-${Math.random().toString(36).slice(2)}@example.com`,
				password: 'password',
				passwordConfirm: 'password'
			});
		expect(response.body.status).toBe(303);
		expect(response.body.location).toBe('/dashboard');
	});

	it('should error if the password does not match', async (context) => {
		const response = await context.agent
			.post('/signup' satisfies Match<RouteId>)
			.type('form')
			.send({
				email: `test-${Math.random().toString(36).slice(2)}@example.com`,
				password: 'password',
				passwordConfirm: 'password2'
			});
		expect(response.body.status).toBe(400);
		const data = devalue.parse(response.body.data);
		expect(data.form.errors.passwordConfirm).toBeDefined();
		expect(data.form.errors.passwordConfirm[0]).toBe("Values don't match.");
	});

	it('should error if the email is already taken', async (context) => {
		const response = await context.agent
			.post('/signup' satisfies Match<RouteId>)
			.type('form')
			.send({
				email: context.user.email,
				password: 'password',
				passwordConfirm: 'password'
			});
		expect(response.body.status).toBe(400);
		const data = devalue.parse(response.body.data);
		expect(data.form.errors.email).toBeDefined();
		expect(data.form.errors.email[0]).toBe('Value must be unique.');
	});
});
