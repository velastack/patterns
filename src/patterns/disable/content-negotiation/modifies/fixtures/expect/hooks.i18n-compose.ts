import { deLocalizeDefault } from "wuchale/url";
import { matchUrl } from "$locales/main.url";
import { locales } from "$locales/data";
const rerouteDeLocalize = (url: string) => {
  const [upath, locale] = deLocalizeDefault(url, locales);
  const { path } = matchUrl(upath, locale);
  return path ?? url;
};

export const reroute = ({ url }) => rerouteDeLocalize(url.pathname);
