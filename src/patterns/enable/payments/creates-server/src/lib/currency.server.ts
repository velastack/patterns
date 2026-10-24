import type { RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { offered } from '#lib/currency.svelte.js';

/**
 * The currency a visitor reads prices in, decided on the server so the first
 * render already shows it: the one they picked (the `currency` cookie), else
 * their region's when the site offers it, else the business's own. The
 * business's prices never change; the others are estimates at the day's rate.
 *
 * `handleCurrency` puts it in `locals.currency`; the root layout load returns
 * it with the rates, and `currency.hydrate` starts the store from them.
 */

declare global {
	namespace App {
		interface Locals {
			/** One of the currencies the site offers; `handleCurrency` sets it. */
			currency: string;
		}
	}
}

const RATES_URL = 'https://velastack.dev/v1/rates';
const DAY = 24 * 60 * 60 * 1000;
const RETRY = 5 * 60 * 1000;

export interface Rates {
	base: string;
	date: string;
	rates: Record<string, number>;
	/** The currency each country pays in, to go from a visitor's region to one. */
	countries: Record<string, string>;
}

let cached: { rates: Rates; fetchedAt: number } | null = null;
let failedAt = 0;
let inflight: Promise<Rates | null> | null = null;

/**
 * The day's rates from velastack.dev, fetched once a day and shared by every
 * request; the last ones known when it can't be reached, else `null`.
 */
export async function fetchRates(): Promise<Rates | null> {
	if (cached && Date.now() - cached.fetchedAt < DAY) return cached.rates;
	if (Date.now() - failedAt < RETRY) return cached?.rates ?? null;
	inflight ??= (async () => {
		try {
			const response = await fetch(RATES_URL);
			if (!response.ok) throw new Error(`${response.status} from ${RATES_URL}`);
			const rates = (await response.json()) as Rates;
			cached = { rates, fetchedAt: Date.now() };
			return rates;
		} catch (error) {
			console.error('Could not fetch exchange rates:', error);
			failedAt = Date.now();
			return cached?.rates ?? null;
		} finally {
			inflight = null;
		}
	})();
	return inflight;
}

/** What the page needs to convert into `currency`: nothing when it is the business's own, or the site offers one. */
export async function displayRates(currency: string): Promise<Rates | null> {
	return offered.length < 2 || currency === offered[0] ? null : fetchRates();
}

/** The headers a CDN reports the visitor's country in. */
const COUNTRY_HEADERS = ['cf-ipcountry', 'x-vercel-ip-country', 'cloudfront-viewer-country'];

/** The visitor's country as the CDN reports it, else the first Accept-Language region, else `null`. */
export function requestCountry(request: Request): string | null {
	for (const name of COUNTRY_HEADERS) {
		const value = request.headers.get(name)?.trim().toUpperCase();
		if (value && /^[A-Z]{2}$/.test(value)) return value;
	}
	const first = request.headers.get('accept-language')?.split(',')[0]?.trim();
	const region = first?.match(/^[A-Za-z]{2,3}-([A-Za-z]{2})(?:[-;]|$)/)?.[1];
	return region?.toUpperCase() ?? null;
}

export async function resolveCurrency(
	event: Pick<RequestEvent, 'cookies' | 'request'>
): Promise<string> {
	const home = offered[0] ?? '';
	if (offered.length < 2) return home;
	const picked = event.cookies.get('currency')?.toUpperCase();
	if (picked && offered.includes(picked)) return picked;
	const country = requestCountry(event.request);
	if (!country) return home;
	const regional = (await fetchRates())?.countries[country];
	return regional && offered.includes(regional) ? regional : home;
}

export const handleCurrency: Handle = async ({ event, resolve }) => {
	event.locals.currency = await resolveCurrency(event);
	return resolve(event);
};
