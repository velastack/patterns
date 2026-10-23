import { describe, expect, it } from 'vitest';
import { requestCountry } from './currency.server.js';

const request = (headers: Record<string, string>) =>
	new Request('https://example.com/', { headers });

describe('requestCountry', () => {
	it('trusts the CDN first', () => {
		expect(requestCountry(request({ 'cf-ipcountry': 'mx', 'accept-language': 'en-US' }))).toBe(
			'MX'
		);
		expect(requestCountry(request({ 'x-vercel-ip-country': 'GT' }))).toBe('GT');
	});

	it('falls back to the first Accept-Language region', () => {
		expect(requestCountry(request({ 'accept-language': 'es-MX,es;q=0.9,en;q=0.8' }))).toBe('MX');
		expect(requestCountry(request({ 'accept-language': 'en-us' }))).toBe('US');
	});

	it('gives up on a language without a region, or an unknown CDN value', () => {
		expect(requestCountry(request({ 'accept-language': 'es' }))).toBeNull();
		expect(requestCountry(request({ 'cf-ipcountry': 'XX1' }))).toBeNull();
		expect(requestCountry(request({}))).toBeNull();
	});
});
