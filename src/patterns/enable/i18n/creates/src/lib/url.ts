import { deLocalizeDefault, stringifyPattern } from "wuchale/url";
import type { Locale } from "#locales/data.js";
import { matchUrl } from "#locales/main.url.js";
import { locales } from "#locales/data.js";

// wuchale treats locales[0] as the source locale, so it is the one served unprefixed
export const defaultLocale: Locale = locales[0];

/**
 * Localizer for wuchale's `url.localize` config. Compiled URLs in components
 * are passed through this, so the default locale stays unprefixed.
 */
export function localize(path: string, locale: Locale) {
  if (locale === defaultLocale) {
    return path;
  }

  // matches wuchale's localizeDefault, which drops the trailing slash
  const localized = `/${locale}${path}`;
  return localized.endsWith("/") ? localized.slice(0, -1) : localized;
}

/**
 * Whether a page has a URL per language (it is under `url.patterns` in
 * wuchale.config.js). The other pages follow the visitor's preference: see
 * src/lib/locale.ts.
 */
export function hasLocalizedUrl(pathname: string) {
  const [pathOnly] = deLocalizeDefault(pathname, locales);
  return matchUrl(pathOnly, defaultLocale).path !== null;
}

export function translateUrl(
  url: string,
  fromLocale: Locale,
  toLocale: Locale,
) {
  const [pathOnly] = deLocalizeDefault(url, locales);
  const result = matchUrl(pathOnly, fromLocale);
  if (result.path !== null) {
    const targetPath = stringifyPattern(
      result.altPatterns[toLocale],
      result.params,
    );
    return localize(targetPath, toLocale);
  }
  return localize(pathOnly, toLocale);
}
