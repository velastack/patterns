import { createNegotiation } from "sveltekit-negotiate";

export const { handle, reroute, negotiate, Negotiate } = createNegotiation({
  "text/markdown": { extension: ".md" },
  "application/json": { extension: ".json" },
});
