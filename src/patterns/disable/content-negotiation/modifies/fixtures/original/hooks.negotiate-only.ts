import { reroute as negotiateReroute } from "$lib/negotiate";

export const reroute = ({ url }) => negotiateReroute(url.pathname);
