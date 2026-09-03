import type { RegistryItem } from "../core/types";

/** A slice of what every shadcn-svelte style index lists, enough for the tests here. */
export const REGISTRY_UI_ITEMS = [
  "badge",
  "button",
  "card",
  "command",
  "dropdown-menu",
  "input",
  "popover",
  "select",
  "separator",
  "sonner",
];

export function registryItems(
  names: (string | RegistryItem)[] = REGISTRY_UI_ITEMS,
): RegistryItem[] {
  return names.map((entry) =>
    typeof entry === "string" ? { name: entry, type: "registry:ui" } : entry,
  );
}

/**
 * Stands in for `fetch` against the registry: answers every URL with the
 * given index and records the URLs asked for.
 */
export function registryFetch(
  items: (string | RegistryItem)[] = REGISTRY_UI_ITEMS,
  calls: string[] = [],
): typeof fetch {
  const body = JSON.stringify(registryItems(items));
  return (async (input: string | URL | Request) => {
    calls.push(String(input instanceof Request ? input.url : input));
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

/** A `fetch` with no network behind it. */
export function offlineFetch(): typeof fetch {
  return (async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch;
}
