import { deLocalizeDefault, fillParams } from "wuchale/url";
import type { Locale } from "../locales/data";
import { matchUrl } from "../locales/main.url";
import { locales } from "../locales/data";

export const defaultLocale = "en";

export function localize(path: string, locale: Locale) {
  if (locale === defaultLocale) {
    return path;
  }

  return `/${locale}${path}`;
}

export function translateUrl(url: string, fromLocale: Locale, toLocale: Locale) {
  const [pathOnly] = deLocalizeDefault(url, locales);
  const result = matchUrl(pathOnly, fromLocale);
  if (result.path !== null) {
    const targetPath = fillParams(result.params, result.altPatterns[toLocale]);
    return localize(targetPath, toLocale);
  }
  return localize(url, toLocale);
}
