import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  TANSTACK_TABLE_CORE,
  TANSTACK_TABLE_CORE_MAJOR,
} from "../core/constants";
import { InvalidArgumentError } from "../core/errors";
import { resolveUiDir } from "./registry";

/** The components this package ships that are built on `@tanstack/table-core`. */
export const TABLE_CORE_COMPONENTS = [
  "data-table",
  "column-header",
  "faceted-filter",
  "data-table-pagination",
];

const MIGRATION_GUIDE =
  "https://tanstack.com/table/latest/docs/framework/svelte/guide/migrating";

/**
 * The major of the `@tanstack/table-core` range `package.json` declares, when
 * it names one (`^8.21.3` is 8; `latest` or `workspace:*` is undefined).
 */
export function declaredTableCoreMajor(root: string): number | undefined {
  const packageJsonPath = path.join(root, "package.json");
  if (!existsSync(packageJsonPath)) return undefined;
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const range =
    pkg.dependencies?.["@tanstack/table-core"] ??
    pkg.devDependencies?.["@tanstack/table-core"];
  const major = range?.match(/^[\^~>=v\s]*(\d+)/)?.[1];
  return major === undefined ? undefined : Number(major);
}

/** Whether the project's `data-table` helper is the v8 one (`createSvelteTable`). */
function hasV8DataTable(root: string): boolean {
  const index = path.join(resolveUiDir(root), "data-table", "index.ts");
  return (
    existsSync(index) &&
    readFileSync(index, "utf8").includes("createSvelteTable")
  );
}

function upgradeSteps(): string {
  return (
    "Nothing was changed. To upgrade:\n" +
    `  1. Install ${TANSTACK_TABLE_CORE}:  npm install ${TANSTACK_TABLE_CORE}\n` +
    `  2. Replace the table helpers:        vela ui add ${TABLE_CORE_COMPONENTS.join(" ")} --overwrite\n` +
    `  3. Move existing list pages to the v9 API (createTable, tableFeatures): ${MIGRATION_GUIDE}\n` +
    "Then run this again."
  );
}

/**
 * Refuses a project still on TanStack Table v8, before anything is written.
 *
 * The scaffold list pages and the table helpers target v9. A project set up
 * before that has `@tanstack/table-core@^8` and v8 helpers; the package is
 * never upgraded by `installPackages` (it is already present) and the helpers
 * are never replaced (they already exist), so a new page would not compile,
 * and upgrading in place would break the list pages already there.
 */
export function assertTableCoreV9(root: string): void {
  const major = declaredTableCoreMajor(root);
  const outdatedPackage =
    major !== undefined && major < TANSTACK_TABLE_CORE_MAJOR;
  if (!outdatedPackage && !hasV8DataTable(root)) return;

  const found = outdatedPackage
    ? `package.json pins @tanstack/table-core ${major}.x`
    : "its data-table helper is the v8 one (createSvelteTable)";
  throw new InvalidArgumentError(
    `This project uses TanStack Table v8 (${found}), and scaffold list pages now need v${TANSTACK_TABLE_CORE_MAJOR}.\n\n` +
      upgradeSteps(),
  );
}

/**
 * Refuses to add v9 table helpers next to a v8 `@tanstack/table-core`, which
 * `installPackages` would leave in place.
 */
export function assertTableCorePackage(
  root: string,
  components: string[],
): void {
  const tableComponents = components.filter((component) =>
    TABLE_CORE_COMPONENTS.includes(component),
  );
  if (tableComponents.length === 0) return;
  const major = declaredTableCoreMajor(root);
  if (major === undefined || major >= TANSTACK_TABLE_CORE_MAJOR) return;

  throw new InvalidArgumentError(
    `${tableComponents.join(", ")} target${tableComponents.length === 1 ? "s" : ""} TanStack Table v${TANSTACK_TABLE_CORE_MAJOR}, and package.json pins @tanstack/table-core ${major}.x.\n\n` +
      `Nothing was changed. Install ${TANSTACK_TABLE_CORE} first (npm install ${TANSTACK_TABLE_CORE}), then run this again.`,
  );
}

/**
 * Whether `ui/pagination` is the table footer this package shipped under that
 * name (one `Pagination` taking a `table`), not shadcn-svelte's pagination,
 * whose index exports the parts (`Content`, `Item`, `Link`, ...).
 */
function hasLegacyPagination(root: string): boolean {
  const index = path.join(resolveUiDir(root), "pagination", "index.ts");
  return existsSync(index) && !readFileSync(index, "utf8").includes("Content");
}

/**
 * Refuses a project whose `ui/pagination` is still the old table footer,
 * before anything is written.
 *
 * The footer is `data-table-pagination` now, built on shadcn-svelte's
 * `pagination`, which installs to that same directory. A component that is
 * present is never replaced, so the new footer would import parts the old
 * file does not export; and replacing it in place would break the list pages
 * that render the old one.
 */
export function assertRegistryPagination(root: string): void {
  if (!hasLegacyPagination(root)) return;

  throw new InvalidArgumentError(
    "This project's ui/pagination is the table footer older scaffolds used. The footer is now data-table-pagination, built on shadcn-svelte's pagination, which belongs in that directory.\n\n" +
      "Nothing was changed. To upgrade:\n" +
      "  1. Replace ui/pagination with shadcn-svelte's:  vela ui add pagination --overwrite\n" +
      "  2. Add the new footer:                          vela ui add data-table-pagination\n" +
      '  3. In existing list pages, import { DataTablePagination } from "#lib/components/ui/data-table-pagination/index.js"\n' +
      "     in place of { Pagination }, and render <DataTablePagination {table} />.\n" +
      "Then run this again.",
  );
}
