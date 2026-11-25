import fs from "node:fs";
import path from "node:path";
import type { ModifyOutcome } from "../../../../core/types";

import {
  LEGACY_POCKETBASE_TYPES,
  POCKETBASE_TYPES,
} from "../../../../core/constants";

export { LEGACY_POCKETBASE_TYPES, POCKETBASE_TYPES };

const VITEST_CONFIGS = ["ts", "mts", "js", "mjs"].map(
  (ext) => `vitest.config.${ext}`,
);

/**
 * SvelteKit 3's `$app/tsconfig` lists no files: the project's own `include`
 * decides what is type-checked, and `sv create` writes `["src",
 * "vite.config.ts"]`. A backend adds three things that have to be in it, as
 * they are in vela's minimal template: `test` (the server-test context that
 * every `server.test.ts` reads), the vitest config, and PocketBase's generated
 * types, without which `Schemas` is missing from `@velastack/pocketbase`.
 *
 * Entries already there stay, in their order, but for one: the entry for
 * where the PocketBase types used to be (`LEGACY_POCKETBASE_TYPES`) becomes
 * the current one where it stands, keeping a leading `./` if it had one, and
 * is dropped when the current one is there as well. A tsconfig with no
 * `include` checks everything already; one that is not plain JSON (comments)
 * is left alone with the entries to add.
 */
export function modifyTsconfigBackend(root: string): ModifyOutcome {
  const filePath = path.join(root, "tsconfig.json");
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(filePath, "utf8");
  const vitestConfig =
    VITEST_CONFIGS.find((name) => fs.existsSync(path.join(root, name))) ??
    "vitest.config.ts";
  const wanted = ["test", vitestConfig, POCKETBASE_TYPES];

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(original) as Record<string, unknown>;
  } catch {
    return {
      status: "failed",
      message: `Add these to the "include" array of tsconfig.json: ${wanted
        .map((entry) => JSON.stringify(entry))
        .join(", ")}`,
    };
  }
  const include = config.include;
  if (include === undefined) {
    return { status: "success", changed: false };
  }
  if (!Array.isArray(include)) {
    return {
      status: "failed",
      message: `tsconfig.json "include" is not an array; it needs ${wanted.join(", ")}`,
    };
  }

  const normalize = (entry: unknown) =>
    typeof entry === "string" ? entry.replace(/^\.\//, "") : entry;
  const isCurrentTypes = (entry: unknown) =>
    normalize(entry) === POCKETBASE_TYPES;
  const hasCurrentTypes = include.some(isCurrentTypes);
  const next: unknown[] = [];
  for (const entry of include as unknown[]) {
    if (normalize(entry) !== LEGACY_POCKETBASE_TYPES) {
      next.push(entry);
    } else if (!hasCurrentTypes && !next.some(isCurrentTypes)) {
      // The first old entry turns into the new one; any other goes.
      const prefix = String(entry).startsWith("./") ? "./" : "";
      next.push(`${prefix}${POCKETBASE_TYPES}`);
    }
  }
  const has = (entry: string) =>
    next.some((existing) => normalize(existing) === entry);
  const insertAfter = (entry: string, after: (e: unknown) => boolean) => {
    if (has(entry)) return;
    let index = -1;
    next.forEach((e, i) => {
      if (after(e)) index = i;
    });
    next.splice(index === -1 ? next.length : index + 1, 0, entry);
  };
  insertAfter("test", (e) => normalize(e) === "src");
  insertAfter(vitestConfig, (e) =>
    /^vite\.config\.[cm]?[jt]s$/.test(String(normalize(e))),
  );
  insertAfter(POCKETBASE_TYPES, () => false);

  if (
    next.length === include.length &&
    next.every((entry, index) => entry === include[index])
  ) {
    return { status: "success", changed: false };
  }
  config.include = next;
  const indent = original.match(/^\{\s*\n([\t ]+)/)?.[1] ?? "\t";
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, indent)}\n`);
  return { status: "success", changed: true };
}
