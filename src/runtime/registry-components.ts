/**
 * Every shadcn-svelte registry item the patterns ask for, by name: the
 * `components` a pattern returns, the registry dependencies of the components
 * this package ships (`customDependencies`), and each `ui/<name>` the
 * generated pages import.
 *
 * The registry is not ours and drops items without notice: `form` left every
 * style's index on 2026-11-24 (huntabyte/shadcn-svelte#2989), and every
 * superforms pattern failed on "Unknown component" until it was bundled
 * here. `registry-components.test.ts` holds the patterns to this list, so a
 * name that goes missing upstream is one line to find here: bundle the
 * component under `src/ui/components` and delete its line.
 *
 * Verified against `https://shadcn-svelte.com/registry/styles/<style>/index.json`
 * for `vega` and `nova` on 2026-11-24. To check again:
 *
 *   curl -s https://shadcn-svelte.com/registry/styles/vega/index.json \
 *     | jq -r '.[] | select(.type == "registry:ui") | .name'
 */
export const REGISTRY_COMPONENTS = [
  "alert-dialog",
  "avatar",
  "badge",
  "breadcrumb",
  "button",
  "card",
  "checkbox",
  "collapsible",
  "command",
  "dialog",
  "dropdown-menu",
  "input",
  "label",
  "pagination",
  "popover",
  "select",
  "separator",
  "sheet",
  "sidebar",
  "table",
  "textarea",
] as const;
