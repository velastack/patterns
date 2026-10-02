import { deLocalizeDefault } from "wuchale/url";
import { matchUrl } from "$locales/main.url";
import { locales } from "$locales/data";
import { reroute as negotiateReroute } from "$lib/negotiate";

const rerouteDeLocalize = (url: string) => {
  const [upath, locale] = deLocalizeDefault(url, locales);
  const { path } = matchUrl(upath, locale);
  return path ?? url;
};

export const reroute = ({ url }) =>
  rerouteDeLocalize(negotiateReroute(url.pathname));
