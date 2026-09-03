import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecuteCommand, Options, Result } from "../core/types";
import {
  installComponents,
  packageName,
  resolveUiDir,
  writeResult,
} from "./write-result";

const tempDirs: string[] = [];

function makeTempRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "write-result-"));
  tempDirs.push(root);
  return root;
}

function makeOptions(root: string): Options {
  return {
    argv: ["test"],
    env: "runtime",
    root,
    features: {
      auth: false,
      api: false,
      apiKeys: false,
      backend: false,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
      cms: false,
    },
    input: {},
  };
}

function emptyResult(): Result {
  return {
    creates: [],
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("writeResult", () => {
  it("writes creates/modifies and removes deletes", async () => {
    const root = makeTempRoot();
    const deletePath = path.join(root, "src", "old.txt");
    mkdirSync(path.dirname(deletePath), { recursive: true });
    writeFileSync(deletePath, "remove me", "utf8");

    const modifyPath = path.join(root, "src", "existing.ts");

    const result = await writeResult(
      {
        ...emptyResult(),
        creates: [
          {
            path: "src/new.ts",
            language: "ts",
            content: "export const a = 1;\n",
            status: "success",
          },
        ],
        modifies: [
          {
            path: modifyPath,
            language: "ts",
            content: "export const b = 2;\n",
            status: "success",
          },
        ],
        deletes: [
          {
            path: "src/old.txt",
            language: "text",
            content: "",
            status: "success",
          },
        ],
      },
      makeOptions(root),
      { executeCommand: vi.fn() },
    );

    expect(readFileSync(path.join(root, "src", "new.ts"), "utf8")).toBe(
      "export const a = 1;\n",
    );
    expect(readFileSync(modifyPath, "utf8")).toBe("export const b = 2;\n");
    expect(existsSync(deletePath)).toBe(false);
    expect(result.components).toEqual([]);
    expect(result.packages).toEqual([]);
  });

  it("carries failed and not-found files through without writing them", async () => {
    // A modifier that cannot recognise the file it was asked to edit reports
    // `failed` with a paste-ready snippet. Nothing should be written, but the
    // entry has to reach the caller — these loops used to drop it, so the
    // snippet never left this function and the run looked entirely clean.
    const root = makeTempRoot();
    const result = await writeResult(
      {
        ...emptyResult(),
        modifies: [
          {
            path: "src/hooks.server.ts",
            language: "ts",
            content: "",
            status: "failed",
            message: "Add `handleCms` to your handle sequence.",
          },
        ],
        creates: [
          {
            path: "vite.config.ts",
            language: "ts",
            content: "",
            status: "not-found",
            message: "Create a Vite config first.",
          },
        ],
      },
      makeOptions(root),
    );

    expect(existsSync(path.join(root, "src/hooks.server.ts"))).toBe(false);
    expect(existsSync(path.join(root, "vite.config.ts"))).toBe(false);

    expect(result.modifies).toHaveLength(1);
    expect(result.modifies[0]).toMatchObject({
      path: "src/hooks.server.ts",
      status: "failed",
      message: "Add `handleCms` to your handle sequence.",
    });

    expect(result.creates).toHaveLength(1);
    expect(result.creates[0]).toMatchObject({
      path: "vite.config.ts",
      status: "not-found",
      message: "Create a Vite config first.",
    });
  });

  it("does not let a failed entry overwrite an existing file", async () => {
    const root = makeTempRoot();
    writeFileSync(path.join(root, "keep.ts"), "original", "utf8");

    await writeResult(
      {
        ...emptyResult(),
        creates: [
          {
            path: "keep.ts",
            language: "ts",
            content: "clobbered",
            status: "failed",
            message: "nope",
          },
        ],
      },
      makeOptions(root),
    );

    expect(readFileSync(path.join(root, "keep.ts"), "utf8")).toBe("original");
  });

  it("installs only missing packages and components", async () => {
    const root = makeTempRoot();
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "tmp", dependencies: { existing: "^1.0.0" } }),
      "utf8",
    );

    mkdirSync(path.join(root, "src", "lib", "components", "ui", "button"), {
      recursive: true,
    });

    const executeCommand = vi.fn<
      (
        cwd: string,
        operation: "execute" | "install",
        args: string[],
      ) => Promise<void>
    >(async () => {});

    const result = await writeResult(
      {
        ...emptyResult(),
        packages: ["existing", "new-package"],
        components: ["button", "column-header"],
      },
      makeOptions(root),
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenNthCalledWith(1, root, "install", [
      "new-package",
    ]);
    expect(executeCommand).toHaveBeenNthCalledWith(2, root, "install", [
      "@tanstack/table-core@^8.21.3",
    ]);
    expect(executeCommand).toHaveBeenNthCalledWith(3, root, "execute", [
      "shadcn-svelte",
      "add",
      "--yes",
      "--overwrite",
      "dropdown-menu",
    ]);

    expect(
      existsSync(
        path.join(
          root,
          "src",
          "lib",
          "components",
          "ui",
          "column-header",
          "column-header.svelte",
        ),
      ),
    ).toBe(true);

    expect(result.components).toEqual(["column-header", "dropdown-menu"]);
    expect(result.packages).toEqual([
      "new-package",
      "@tanstack/table-core@^8.21.3",
    ]);
  });

  it("ships data-table locally instead of asking shadcn-svelte for it", async () => {
    const root = makeTempRoot();
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "tmp", dependencies: {} }),
      "utf8",
    );

    const executeCommand = vi.fn<
      (
        cwd: string,
        operation: "execute" | "install",
        args: string[],
      ) => Promise<void>
    >(async () => {});

    const result = await writeResult(
      { ...emptyResult(), components: ["data-table"] },
      makeOptions(root),
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(root, "install", [
      "@tanstack/table-core@^8.21.3",
    ]);
    for (const file of [
      "index.ts",
      "data-table.svelte.ts",
      "flex-render.svelte",
      "render-helpers.ts",
    ]) {
      expect(
        existsSync(
          path.join(root, "src", "lib", "components", "ui", "data-table", file),
        ),
      ).toBe(true);
    }
    expect(result.components).toEqual(["data-table"]);
    expect(result.packages).toEqual(["@tanstack/table-core@^8.21.3"]);
  });

  it("installs a pinned spec but skips it once the name is present", async () => {
    const root = makeTempRoot();
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "tmp",
        devDependencies: { "@wuchale/svelte": "^0.21.1" },
      }),
      "utf8",
    );

    const executeCommand = vi.fn<
      (
        cwd: string,
        operation: "execute" | "install",
        args: string[],
      ) => Promise<void>
    >(async () => {});

    const result = await writeResult(
      {
        ...emptyResult(),
        // Ranges are what the i18n pattern declares. The already-installed
        // check compares names, so the scoped package below must be recognized
        // as present despite the spec carrying a range.
        packages: ["wuchale@^0.26.3", "@wuchale/svelte@^0.21.1"],
      },
      makeOptions(root),
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenNthCalledWith(1, root, "install", [
      "wuchale@^0.26.3",
    ]);
    expect(result.packages).toEqual(["wuchale@^0.26.3"]);
  });
});

describe("installComponents", () => {
  const SHADCN_ADD = ["shadcn-svelte", "add", "--yes", "--overwrite"];

  function execSpy() {
    return vi.fn<ExecuteCommand>(async () => {});
  }

  function makeProject(
    dependencies: Record<string, string> = {},
    components: string[] = [],
  ) {
    const root = makeTempRoot();
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "tmp", dependencies }),
      "utf8",
    );
    for (const component of components) {
      mkdirSync(uiPath(root, component), { recursive: true });
    }
    return root;
  }

  function uiPath(root: string, ...rest: string[]) {
    return path.join(root, "src", "lib", "components", "ui", ...rest);
  }

  it("reports requested components that already exist as skipped", async () => {
    const root = makeProject({}, ["button", "card"]);
    const executeCommand = execSpy();

    const result = await installComponents(
      { root, components: ["button", "card", "badge"] },
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(root, "execute", [
      ...SHADCN_ADD,
      "badge",
    ]);
    expect(result).toEqual({
      installed: ["badge"],
      skipped: ["button", "card"],
      packages: [],
    });
  });

  it("installs nothing and spawns nothing when everything is present", async () => {
    const root = makeProject({}, ["button", "data-table"]);
    const executeCommand = execSpy();

    const result = await installComponents(
      { root, components: ["button", "data-table"] },
      { executeCommand },
    );

    expect(executeCommand).not.toHaveBeenCalled();
    expect(result).toEqual({
      installed: [],
      skipped: ["button", "data-table"],
      packages: [],
    });
  });

  it("re-copies a custom component under overwrite but leaves its existing dependencies alone", async () => {
    const root = makeProject({ "@tanstack/table-core": "^8.21.3" }, [
      "column-header",
      "dropdown-menu",
      "button",
    ]);
    const stale = uiPath(root, "column-header", "column-header.svelte");
    writeFileSync(stale, "old", "utf8");
    const executeCommand = execSpy();

    const result = await installComponents(
      { root, components: ["column-header"], overwrite: true },
      { executeCommand },
    );

    expect(readFileSync(stale, "utf8")).not.toBe("old");
    expect(executeCommand).not.toHaveBeenCalled();
    expect(result).toEqual({
      installed: ["column-header"],
      skipped: [],
      packages: [],
    });
  });

  it("hands an existing public component back to shadcn-svelte under overwrite", async () => {
    const root = makeProject({}, ["button"]);
    const executeCommand = execSpy();

    const result = await installComponents(
      { root, components: ["button"], overwrite: true },
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenCalledWith(root, "execute", [
      ...SHADCN_ADD,
      "button",
    ]);
    expect(result).toEqual({
      installed: ["button"],
      skipped: [],
      packages: [],
    });
  });

  it("copies custom components where components.json points aliases.ui", async () => {
    const root = makeProject({ "@tanstack/table-core": "^8.21.3" });
    writeFileSync(
      path.join(root, "components.json"),
      JSON.stringify({ aliases: { ui: "$lib/ui" } }),
      "utf8",
    );

    expect(resolveUiDir(root)).toBe(path.join(root, "src", "lib", "ui"));

    await installComponents(
      { root, components: ["data-table"] },
      { executeCommand: execSpy() },
    );

    expect(
      existsSync(path.join(root, "src", "lib", "ui", "data-table", "index.ts")),
    ).toBe(true);
    expect(existsSync(uiPath(root, "data-table"))).toBe(false);
  });

  it("falls back to src/lib/components/ui without a usable alias", async () => {
    const root = makeTempRoot();
    const fallback = uiPath(root);

    expect(resolveUiDir(root)).toBe(fallback);

    const configPath = path.join(root, "components.json");
    writeFileSync(configPath, JSON.stringify({ aliases: { ui: "@ui" } }));
    expect(resolveUiDir(root)).toBe(fallback);

    writeFileSync(configPath, JSON.stringify({ aliases: { ui: "$lib" } }));
    expect(resolveUiDir(root)).toBe(path.join(root, "src", "lib"));

    writeFileSync(configPath, "{ not json");
    expect(resolveUiDir(root)).toBe(fallback);
  });

  it("formats installed components with the project's prettier settings", async () => {
    const root = makeProject({ "@tanstack/table-core": "^8.21.3" });
    writeFileSync(
      path.join(root, ".prettierrc"),
      JSON.stringify({ useTabs: true, singleQuote: true }),
      "utf8",
    );
    // Stand in for `shadcn-svelte add`, which writes files in the registry's
    // own style rather than the project's.
    const executeCommand = vi.fn<ExecuteCommand>(async (cwd, operation) => {
      if (operation !== "execute") return;
      mkdirSync(uiPath(cwd, "badge"), { recursive: true });
      writeFileSync(
        uiPath(cwd, "badge", "index.ts"),
        'import Root from "./badge.svelte";\nexport {\n    Root,\n  Root as Badge };\n',
        "utf8",
      );
    });

    await installComponents(
      { root, components: ["data-table", "badge"] },
      { executeCommand },
    );

    expect(readFileSync(uiPath(root, "data-table", "index.ts"), "utf8")).toBe(
      [
        "export { default as FlexRender } from './flex-render.svelte';",
        "export { renderComponent, renderSnippet } from './render-helpers.js';",
        "export { createSvelteTable } from './data-table.svelte.js';",
        "",
      ].join("\n"),
    );
    expect(readFileSync(uiPath(root, "badge", "index.ts"), "utf8")).toBe(
      "import Root from './badge.svelte';\nexport { Root, Root as Badge };\n",
    );
  });

  it("pulls badge in for cells", async () => {
    const root = makeProject();
    const executeCommand = execSpy();

    const result = await installComponents(
      { root, components: ["cells"] },
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(root, "execute", [
      ...SHADCN_ADD,
      "badge",
    ]);
    expect(result.installed).toEqual(["badge", "cells"]);
  });

  it("pulls input and formsnap in for file-form, not form", async () => {
    const root = makeProject();
    const executeCommand = execSpy();

    const result = await installComponents(
      { root, components: ["file-form"] },
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenNthCalledWith(1, root, "install", [
      "formsnap@^2.0.1",
    ]);
    expect(executeCommand).toHaveBeenNthCalledWith(2, root, "execute", [
      ...SHADCN_ADD,
      "input",
    ]);
    expect(result).toEqual({
      installed: ["file-form", "input"],
      skipped: [],
      packages: ["formsnap@^2.0.1"],
    });
  });

  it("no longer pulls badge in for multiselect", async () => {
    const root = makeProject({ formsnap: "^2.0.1" });
    const executeCommand = execSpy();

    await installComponents(
      { root, components: ["multiselect"] },
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand).toHaveBeenCalledWith(root, "execute", [
      ...SHADCN_ADD,
      "button",
      "command",
      "popover",
    ]);
  });
});

describe("packageName", () => {
  it("returns a bare name unchanged", () => {
    expect(packageName("wuchale")).toBe("wuchale");
  });

  it("strips a range from an unscoped package", () => {
    expect(packageName("wuchale@^0.26.3")).toBe("wuchale");
  });

  it("keeps the scope on a scoped package with no range", () => {
    expect(packageName("@wuchale/svelte")).toBe("@wuchale/svelte");
  });

  it("strips a range from a scoped package", () => {
    expect(packageName("@wuchale/svelte@^0.21.1")).toBe("@wuchale/svelte");
  });

  it("handles a pinned exact version", () => {
    expect(packageName("stripe@19.3.0")).toBe("stripe");
  });
});
