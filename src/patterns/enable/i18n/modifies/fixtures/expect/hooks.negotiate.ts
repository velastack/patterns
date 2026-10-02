import { reroute as negotiateReroute } from "#lib/negotiate.js";
import { deLocalizeDefault } from "wuchale/url";
import { matchUrl } from "#locales/main.url.js";
import { locales } from "#locales/data.js";

const rerouteDeLocalize = (url: string) => {
  const [upath, locale] = deLocalizeDefault(url, locales);
  const { path } = matchUrl(upath, locale);
  return path ?? url;
};

export const reroute = ({ url }) =>
  rerouteDeLocalize(negotiateReroute(url.pathname));
