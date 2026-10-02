import { describe, expect, it } from "vitest";
import { isLibSpecifier, libAliasPath, libSpecifier } from "./lib-specifier";

// sv 1.0.1 `lib-alias`: a `$lib/<path>` import becomes `#lib/<path>`, with
// `.js`, `.ts`, `/index.js` or `/index.ts` appended (whichever exists first;
// `.ts` written as `.js`) unless the path already ends in `.js` or `.ts`.
describe("libSpecifier follows sv's lib-alias rules", () => {
  it.each([
    // A .ts or .js module: .js.
    ["site.ts", "#lib/site.js"],
    ["utils.js", "#lib/utils.js"],
    ["server/workflows.ts", "#lib/server/workflows.js"],
    ["schemas/contact.ts", "#lib/schemas/contact.js"],
    // A .svelte.ts module: .svelte.js.
    [
      "components/payments/use-stripe.svelte.ts",
      "#lib/components/payments/use-stripe.svelte.js",
    ],
    ["state.svelte.js", "#lib/state.svelte.js"],
    // A directory: /index.js.
    ["components/ui/button", "#lib/components/ui/button/index.js"],
    ["components/ui/button/", "#lib/components/ui/button/index.js"],
    ["components/ui/button/index.ts", "#lib/components/ui/button/index.js"],
    // Files imported by their own name keep it.
    ["components/app-sidebar.svelte", "#lib/components/app-sidebar.svelte"],
    ["assets/favicon.svg", "#lib/assets/favicon.svg"],
    ["content/blog/welcome.svx", "#lib/content/blog/welcome.svx"],
    ["styles/app.css", "#lib/styles/app.css"],
    ["data/countries.json", "#lib/data/countries.json"],
    // src/lib itself.
    ["", "#lib"],
    ["./", "#lib"],
  ])("%s → %s", (rel, expected) => {
    expect(libSpecifier(rel)).toBe(expected);
  });
});

describe("isLibSpecifier", () => {
  it.each([
    ["#lib/site.js", "site"],
    ["#lib/site.ts", "site"],
    ["#lib/site.js", "site.ts"],
    ["$lib/site", "site"],
    ["$lib/site", "site.ts"],
    ["#lib/components/ui/avatar/index.js", "components/ui/avatar"],
    ["#lib/components/ui/avatar/index.ts", "components/ui/avatar"],
    ["$lib/components/ui/avatar", "components/ui/avatar"],
    ["#lib/components/team-switcher.svelte", "components/team-switcher.svelte"],
    ["$lib/components/team-switcher.svelte", "components/team-switcher.svelte"],
    [
      "#lib/components/payments/use-stripe.svelte.js",
      "components/payments/use-stripe.svelte.ts",
    ],
    [
      "$lib/components/payments/use-stripe.svelte",
      "components/payments/use-stripe.svelte.ts",
    ],
  ])("%s imports %s", (spec, rel) => {
    expect(isLibSpecifier(spec, rel)).toBe(true);
  });

  it.each([
    ["#lib/site.js", "stripe"],
    ["#lib/sites.js", "site"],
    ["#lib/components/ui/avatar/index.js", "components/ui/avatar-group"],
    ["$lib/negotiate", "negotiate/extra"],
    ["./site.js", "site"],
    ["lib/site.js", "site"],
    ["@velastack/kit", "kit"],
  ])("%s does not import %s", (spec, rel) => {
    expect(isLibSpecifier(spec, rel)).toBe(false);
  });
});

describe("libAliasPath", () => {
  it.each([
    ["#lib", ""],
    ["#lib/", ""],
    ["#lib/components/ui", "components/ui"],
    ["#lib/ui/", "ui"],
    ["#lib/utils", "utils"],
    // A components.json written before SvelteKit 3.
    ["$lib", ""],
    ["$lib/components/ui", "components/ui"],
  ])("%s → src/lib/%s", (alias, rel) => {
    expect(libAliasPath(alias)).toBe(rel);
  });

  it.each(["@ui", "src/lib/ui", "#libs/ui", "lib/ui", "~/lib"])(
    "%s is not under src/lib",
    (alias) => {
      expect(libAliasPath(alias)).toBeNull();
    },
  );
});
