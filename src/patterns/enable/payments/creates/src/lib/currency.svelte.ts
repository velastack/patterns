import { browser } from '$app/env';
import { site } from '#lib/site.js';

/**
 * Prices and the currency they show in.
 *
 * Every price on the site is in the business's currency, `site.currency`.
 * When `site.currencies` offers more, a visitor can pick one of them and
 * sees each price converted at the day's rate, marked `≈`: an estimate, not
 * what they are charged. The choice is kept in a cookie for a year.
 *
 * Rates come from velastack.dev, which publishes central bank reference
 * rates once for every site (see https://velastack.dev/v1/rates). They are
 * fetched in the browser once a day and kept in localStorage.
 */

const RATES_URL = 'https://velastack.dev/v1/rates';
const COOKIE = 'currency';
const RATES_KEY = 'rates';
const DAY = 24 * 60 * 60 * 1000;

interface Rates {
	base: string;
	date: string;
	rates: Record<string, number>;
	fetchedAt: number;
}

/** The day's rates as velastack.dev sends them, before the store stamps when it got them. */
export type RatesPayload = Pick<Rates, 'base' | 'date' | 'rates'>;

// `site.ts` declares these once payments asked for them; a project that
// enabled payments before that has none, and formats in each price's own
// currency with nothing to convert to.
const business = site as unknown as { currency?: string; country?: string; currencies?: string[] };
const home = business.currency ?? '';

/** The currencies the business shows prices in: its own, then the others it offers. */
export const offered: string[] = home
	? [home, ...(business.currencies ?? []).filter((code) => code !== home)]
	: [];

/**
 * The page's language in the business's country (`es-MX`, not `es`), so a
 * price reads the way the business's customers read it: an English page on
 * a Mexican site shows MXN as `MX$5.50`, a Spanish one as `$5.50`. A bare
 * language would print `360,00 MXN`. On the server the language is the
 * site's default; the server and the browser then agree on the first render.
 */
export function pageLocale(): string {
	// app.html ships `lang="en"`; with i18n the server hook fills the page's own.
	const language = (browser && document.documentElement.lang) || 'en';
	if (!business.country || language.includes('-')) return language;
	return `${language}-${business.country}`;
}

class Currency {
	/** The currency prices show in: the business's own until the visitor picks another. */
	current = $state(home);
	rates = $state<Rates | null>(null);

	#loaded = false;

	/**
	 * Starts from what the server resolved (`handleCurrency`, through the root
	 * layout's data), so the first render shows the visitor's currency on the
	 * server and in the browser alike. Called from the root layout, before any
	 * child renders; a static site has no server to call it.
	 */
	hydrate(current: string, rates: RatesPayload | null) {
		if (offered.includes(current)) this.current = current;
		if (rates) this.rates = { ...rates, fetchedAt: Date.now() };
	}

	/** Reads the cookie and the day's rates, once, in the browser. */
	load() {
		if (!browser || this.#loaded || offered.length < 2) return;
		this.#loaded = true;
		const saved = document.cookie.match(/(?:^|;\s*)currency=([A-Z]{3})/)?.[1];
		if (saved && offered.includes(saved)) this.current = saved;
		this.#loadRates();
	}

	/** Shows prices in `code`, one of `offered`, and remembers it. */
	set(code: string) {
		if (!offered.includes(code)) return;
		this.current = code;
		document.cookie = `${COOKIE}=${code}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;
		if (code !== home) this.#loadRates();
	}

	/** `amount` in `from` as the current currency, or `null` without a rate for either. */
	convert(amount: number, from = home): number | null {
		if (from === this.current || !this.current) return amount;
		const rates = this.rates?.rates;
		const fromRate = rates?.[from];
		const toRate = rates?.[this.current];
		if (!fromRate || !toRate) return null;
		return (amount / fromRate) * toRate;
	}

	/**
	 * `amount` in `from`, as the visitor should read it: in the current
	 * currency with `≈` when it was converted, else as it is. Formatted for
	 * the page's language in the business's country.
	 */
	format(amount: number, from = home): string {
		const converted = this.convert(amount, from);
		if (converted === null || from === this.current || !this.current) return money(amount, from);
		return `≈ ${money(converted, this.current)}`;
	}

	async #loadRates() {
		if (this.rates && Date.now() - this.rates.fetchedAt < DAY) return;
		try {
			const cached = JSON.parse(localStorage.getItem(RATES_KEY) ?? 'null') as Rates | null;
			if (cached && Date.now() - cached.fetchedAt < DAY) {
				this.rates = cached;
				return;
			}
		} catch {
			// Unreadable storage: fetch instead.
		}
		try {
			const response = await fetch(RATES_URL);
			if (!response.ok) return;
			const body = (await response.json()) as RatesPayload;
			const rates: Rates = { base: body.base, date: body.date, rates: body.rates, fetchedAt: Date.now() };
			this.rates = rates;
			localStorage.setItem(RATES_KEY, JSON.stringify(rates));
		} catch {
			// No rates: prices stay in the business's currency.
		}
	}
}

export const currency = new Currency();

/** `amount` in `code`, formatted for the page's language in the business's country. */
export function money(amount: number, code: string): string {
	return new Intl.NumberFormat(pageLocale(), { style: 'currency', currency: code }).format(amount);
}

/** A price in the business's currency, shown the way the visitor reads prices. */
export function formatPrice(amount: number, from = home): string {
	return currency.format(amount, from);
}
