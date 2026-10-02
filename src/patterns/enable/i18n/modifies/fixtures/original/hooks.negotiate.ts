import { reroute as negotiateReroute } from "#lib/negotiate.js";

export const reroute = ({ url }) => negotiateReroute(url.pathname);
