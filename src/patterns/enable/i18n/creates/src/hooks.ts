import { deLocalizeDefault } from "wuchale/url";
import { matchUrl } from "$locales/main.url";
import { locales } from "$locales/data";

export const reroute = ({ url }) => {
  const [upath, locale] = deLocalizeDefault(url.pathname, locales);
  const { path } = matchUrl(upath, locale);
  return path ?? url.pathname;
};
