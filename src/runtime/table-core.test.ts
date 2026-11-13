import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidArgumentError } from "../core/errors";
import {
  assertRegistryPagination,
  assertTableCorePackage,
  assertTableCoreV9,
  declaredTableCoreMajor,
} from "./table-core";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function makeProject(
  packageJson: Record<string, unknown>,
  files: Record<string, string> = {},
): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "table-core-"));
  tempDirs.push(root);
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(packageJson),
    "utf8",
  );
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content, "utf8");
  }
  return root;
}

const V8_INDEX =
  "export { createSvelteTable } from './data-table.svelte.js';\n";
const V9_INDEX = "export { createTable } from './data-table.svelte.js';\n";

describe("declaredTableCoreMajor", () => {
  it.each([
    ["^8.21.3", 8],
    ["~9.2.4", 9],
    ["9.x", 9],
    [">=8.0.0", 8],
    ["latest", undefined],
    ["workspace:*", undefined],
  ])("reads %s as %s", (range, major) => {
    const root = makeProject({
      dependencies: { "@tanstack/table-core": range },
    });
    expect(declaredTableCoreMajor(root)).toBe(major);
  });

  it("reads devDependencies, and nothing when the package is absent", () => {
    expect(
      declaredTableCoreMajor(
        makeProject({ devDependencies: { "@tanstack/table-core": "^8.0.0" } }),
      ),
    ).toBe(8);
    expect(declaredTableCoreMajor(makeProject({}))).toBeUndefined();
  });
});

describe("assertTableCoreV9", () => {
  it("accepts a project without TanStack Table, or with v9", () => {
    expect(() => assertTableCoreV9(makeProject({}))).not.toThrow();
    expect(() =>
      assertTableCoreV9(
        makeProject(
          { dependencies: { "@tanstack/table-core": "^9.2.4" } },
          { "src/lib/components/ui/data-table/index.ts": V9_INDEX },
        ),
      ),
    ).not.toThrow();
  });

  it("refuses a v8 package with the upgrade steps", () => {
    const root = makeProject({
      dependencies: { "@tanstack/table-core": "^8.21.3" },
    });
    expect(() => assertTableCoreV9(root)).toThrow(InvalidArgumentError);
    expect(() => assertTableCoreV9(root)).toThrow(
      "package.json pins @tanstack/table-core 8.x",
    );
    expect(() => assertTableCoreV9(root)).toThrow(
      "vela ui add data-table column-header faceted-filter data-table-pagination --overwrite",
    );
  });

  it("refuses the v8 data-table helper even with a v9 package", () => {
    const root = makeProject(
      { dependencies: { "@tanstack/table-core": "^9.2.4" } },
      { "src/lib/components/ui/data-table/index.ts": V8_INDEX },
    );
    expect(() => assertTableCoreV9(root)).toThrow("createSvelteTable");
  });

  it("looks for the helper where components.json puts ui components", () => {
    const root = makeProject(
      {},
      {
        "components.json": JSON.stringify({ aliases: { ui: "#lib/ui" } }),
        "src/lib/ui/data-table/index.ts": V8_INDEX,
      },
    );
    expect(() => assertTableCoreV9(root)).toThrow("createSvelteTable");
  });
});

describe("assertTableCorePackage", () => {
  const v8 = { dependencies: { "@tanstack/table-core": "^8.21.3" } };

  it("refuses table components next to a v8 package", () => {
    expect(() =>
      assertTableCorePackage(makeProject(v8), [
        "button",
        "data-table-pagination",
      ]),
    ).toThrow("data-table-pagination targets TanStack Table v9");
  });

  it("lets other components and v9 or absent packages through", () => {
    expect(() =>
      assertTableCorePackage(makeProject(v8), ["button", "cells"]),
    ).not.toThrow();
    expect(() =>
      assertTableCorePackage(makeProject({}), ["data-table"]),
    ).not.toThrow();
  });
});

describe("assertRegistryPagination", () => {
  const INDEX = "src/lib/components/ui/pagination/index.ts";

  it("refuses the table footer older scaffolds left in ui/pagination", () => {
    const root = makeProject(
      {},
      {
        [INDEX]:
          'export { default as Pagination } from "./pagination.svelte";\n',
      },
    );
    expect(() => assertRegistryPagination(root)).toThrow(InvalidArgumentError);
    expect(() => assertRegistryPagination(root)).toThrow(
      "vela ui add pagination --overwrite",
    );
    expect(() => assertRegistryPagination(root)).toThrow(
      "<DataTablePagination {table} />",
    );
  });

  it("accepts shadcn-svelte's pagination, or none", () => {
    expect(() => assertRegistryPagination(makeProject({}))).not.toThrow();
    expect(() =>
      assertRegistryPagination(
        makeProject(
          {},
          {
            [INDEX]:
              'import Content from "./pagination-content.svelte";\nimport Root from "./pagination.svelte";\nexport { Root, Content, Root as Pagination };\n',
          },
        ),
      ),
    ).not.toThrow();
  });
});
