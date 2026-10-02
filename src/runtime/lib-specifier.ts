/**
 * `#lib` specifiers, written the way `sv migrate sveltekit-3` (sv 1.0.1, the
 * `lib-alias` task) writes them. SvelteKit 3 drops `$lib`; projects map
 * `"#lib/*": "./src/lib/*"` in package.json `imports`, and Node subpath
 * imports don't add extensions or resolve directories, so every specifier
 * names the file the import loads:
 *
 * - a `.ts` or `.js` module gets `.js` (`site.ts` → `#lib/site.js`,
 *   `x.svelte.ts` → `#lib/x.svelte.js`);
 * - a directory gets `/index.js` (`components/ui/button` →
 *   `#lib/components/ui/button/index.js`);
 * - `.svelte`, `.svg`, `.svx`, `.css` and `.json` files keep their name.
 */

/** Extensions an import names as they are on disk. */
const KEPT_EXTENSIONS = [".svelte", ".svg", ".svx", ".css", ".json"];

const SCRIPT_EXTENSION = /\.(ts|js)$/;
const INDEX_SUFFIX = /\/index(\.(ts|js))?$/;

function trimSlashes(rel: string): string {
  return rel
    .replace(/\\/g, "/")
    .replace(/^\.?\/+/, "")
    .replace(/\/+$/, "");
}

/**
 * The `#lib` specifier for a path under `src/lib`. `rel` names a file by its
 * name on disk (`site.ts`, `components/app-sidebar.svelte`) or, when its last
 * segment has none of the extensions above, a directory imported through its
 * `index` (`components/ui/button`). `""` is `src/lib` itself: `#lib`.
 */
export function libSpecifier(relPathUnderSrcLib: string): string {
  const rel = trimSlashes(relPathUnderSrcLib);
  if (rel === "" || rel === ".") return "#lib";
  if (SCRIPT_EXTENSION.test(rel))
    return `#lib/${rel.replace(SCRIPT_EXTENSION, ".js")}`;
  if (KEPT_EXTENSIONS.some((ext) => rel.endsWith(ext))) return `#lib/${rel}`;
  return `#lib/${rel}/index.js`;
}

/** `components/ui/avatar/index.js` and `site.ts` → `components/ui/avatar`, `site`. */
function modulePath(rel: string): string {
  return trimSlashes(rel)
    .replace(INDEX_SUFFIX, "")
    .replace(SCRIPT_EXTENSION, "");
}

/**
 * Whether `spec` imports `relPath` under `src/lib`: `#lib/x.js`, `#lib/x.ts`,
 * `#lib/x/index.js`, or the `$lib/x` a project from before SvelteKit 3 still
 * has. `relPath` is written either way (`site`, `site.ts`,
 * `components/ui/avatar`, `components/notifications-bell.svelte`).
 */
export function isLibSpecifier(spec: string, relPath: string): boolean {
  const match = /^[#$]lib(?:\/(.*))?$/.exec(spec);
  if (!match) return false;
  return modulePath(match[1] ?? "") === modulePath(relPath);
}

/**
 * The directory under `src/lib` a `components.json` alias names: `#lib` and
 * `#lib/components/ui` (what shadcn-svelte writes for a SvelteKit 3 project),
 * or the `$lib` forms of a project from before it. Aliases name directories,
 * so no extension is involved. `""` is `src/lib` itself; anything else (a
 * custom alias) is null.
 */
export function libAliasPath(alias: string): string | null {
  const match = /^[#$]lib(?:\/(.*))?$/.exec(alias);
  if (!match) return null;
  return trimSlashes(match[1] ?? "");
}

/** `isLibSpecifier` bound to one path, for the import helpers' module matchers. */
export function libModule(relPath: string): (spec: string) => boolean {
  return (spec) => isLibSpecifier(spec, relPath);
}
