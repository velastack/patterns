import type { StepSpec } from "./cases";

/**
 * What enable-i18n and enable-auth must add up to, whichever is enabled
 * first: a sign-in page has one URL for every language and follows the
 * visitor's preference (the `locale` cookie, then Accept-Language, then the
 * default locale), and that preference is set by opening a public page, never
 * by a data request such as the one a hovered link sends.
 *
 * svelte-check cannot see any of this, so the harness writes this server test
 * into the project and `vela test:server` runs it with the generated ones.
 * It lives here rather than in a pattern: enable-auth alone has no `lang` to
 * assert, and enable-i18n alone has no `/login`.
 */
const SERVER_TEST = `import { describe, it, expect } from 'vitest';

const lang = (html: string) => html.match(/<html lang="([a-z]+)"/)?.[1];

describe('language of the sign-in pages', () => {
	it('follows the locale cookie', async (context) => {
		const response = await context.request.get('/login').set('Cookie', 'locale=es');
		expect(response.status).toBe(200);
		expect(lang(response.text)).toBe('es');
	});

	it('follows Accept-Language without a cookie', async (context) => {
		const response = await context.request.get('/login').set('Accept-Language', 'es');
		expect(lang(response.text)).toBe('es');
	});

	it('prefers the cookie to Accept-Language', async (context) => {
		const response = await context.request
			.get('/login')
			.set('Cookie', 'locale=en')
			.set('Accept-Language', 'es');
		expect(lang(response.text)).toBe('en');
	});

	it('is the default locale with neither', async (context) => {
		const response = await context.request.get('/login');
		expect(lang(response.text)).toBe('en');
	});
});

describe('the locale cookie', () => {
	const setCookie = (response: { headers: Record<string, unknown> }) =>
		String(response.headers['set-cookie'] ?? '');

	it('is set by opening a public page, whose URL decides the language', async (context) => {
		const response = await context.request.get('/es').set('Cookie', 'locale=en');
		expect(lang(response.text)).toBe('es');
		expect(setCookie(response)).toContain('locale=es');
	});

	it('is left alone when it already matches', async (context) => {
		const response = await context.request.get('/es').set('Cookie', 'locale=es');
		expect(setCookie(response)).not.toContain('locale=');
	});

	it('is not set by a data request, such as a preload', async (context) => {
		const english = await context.request.get('/__data.json').set('Cookie', 'locale=es');
		expect(english.status).toBe(200);
		expect(setCookie(english)).not.toContain('locale=');

		const spanish = await context.request.get('/es/__data.json').set('Cookie', 'locale=en');
		expect(spanish.status).toBe(200);
		expect(setCookie(spanish)).not.toContain('locale=');
	});
});
`;

/** A translation only enable-auth ships, and a msgid only its pages have. */
const AUTH_TRANSLATION = 'msgstr "Qué gusto verte de nuevo"';

/**
 * The last step of an auth + i18n case: the catalog is extracted the way a
 * user's next `vela dev` would, then the project must hold the Spanish for
 * the sign-in pages, the language select on both sides of the login, link
 * components wuchale localizes, and pass the server test above.
 */
export const LOCALE_ACCEPTANCE: Pick<
  StepSpec,
  "check" | "after" | "files" | "expectContains"
> = {
  check: true,
  after: "i18nExtract",
  files: { "src/routes/locale.server.test.ts": SERVER_TEST },
  expectContains: {
    "src/locales/es.po": [AUTH_TRANSLATION],
    "src/routes/(app)/+layout.svelte": ["<LanguageSelect />"],
    "src/routes/(public)/root-layout.svelte": ["<LanguageSelect />"],
    // By name only: the project's formatter picks the quotes.
    "wuchale.config.js": ["urlAttribs", "Navbar.Brand", "AuthMenu.Item"],
  },
};
