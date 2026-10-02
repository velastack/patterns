import fs from "node:fs";
import path from "node:path";
import type { ModifyOutcome } from "../../../../core/types";

/** Where `vela sync` writes PocketBase's generated types (`Schemas`, the typed client). */
export const POCKETBASE_TYPES = ".svelte-kit/types/pocketbase/*.d.ts";

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
 * Entries already there stay, in their order. A tsconfig with no `include`
 * checks everything already; one that is not plain JSON (comments) is left
 * alone with the entries to add.
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
  const has = (entry: string) =>
    include.some((existing) => normalize(existing) === entry);
  const next = [...include] as unknown[];
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

  if (next.length === include.length) {
    return { status: "success", changed: false };
  }
  config.include = next;
  const indent = original.match(/^\{\s*\n([\t ]+)/)?.[1] ?? "\t";
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, indent)}\n`);
  return { status: "success", changed: true };
}
