import { deLocalizeDefault, stringifyPattern } from "wuchale/url";
import type { Locale } from "../locales/data";
import { matchUrl } from "../locales/main.url";
import { locales } from "../locales/data";

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
