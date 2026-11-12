import type { Locale } from "#locales/data.js";

/**
 * Where a page's language comes from.
 *
 * Public pages (the ones under `url.patterns` in wuchale.config.js) carry it
 * in the URL: `/` is English, `/es` is Spanish. Every other page, such as a
 * sign-in page or a page behind one, has one URL for every language and
 * follows the visitor's preference: this cookie, set by the last public page
 * they opened or by the language select, then the browser's Accept-Language.
 *
 * A second URL per language is what search engines and shared links need, and
 * neither matters behind a login. Keeping those pages out of the URL scheme
 * also means their redirects, form actions and emailed links need no
 * localizing, and that hovering a link to them never preloads another
 * language.
 */
export const LOCALE_COOKIE = "locale";

const YEAR = 60 * 60 * 24 * 365;

/**
 * The `Set-Cookie` / `document.cookie` value that remembers `locale`. Not
 * HttpOnly: the language select writes it in the browser.
 */
export const localeCookie = (locale: Locale) =>
  `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${YEAR}; SameSite=Lax`;

/** The first language of an Accept-Language header that the site has. */
export function acceptedLocale<L extends string>(
  header: string | null,
  locales: readonly L[],
) {
  const wanted = (header ?? "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter(({ tag, q }) => tag && q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of wanted) {
    const match = locales.find(
      (locale) => tag === locale || tag.startsWith(`${locale}-`),
    );
    if (match) return match;
  }
  return null;
}

/** The language of a request, by the rules above. */
export function pickLocale<L extends string>(request: {
  /** The locale prefix of the URL, if it has one. */
  urlLocale: L | null;
  /** Whether the page has a URL per language. */
  localizedUrl: boolean;
  cookie: string | undefined;
  acceptLanguage: string | null;
  locales: readonly L[];
  defaultLocale: L;
}): L {
  const {
    urlLocale,
    localizedUrl,
    cookie,
    acceptLanguage,
    locales,
    defaultLocale,
  } = request;
  if (urlLocale) return urlLocale;
  if (localizedUrl) return defaultLocale;
  return (
    locales.find((locale) => locale === cookie) ??
    acceptedLocale(acceptLanguage, locales) ??
    defaultLocale
  );
}
