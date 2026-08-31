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
import type { Options, Result } from "../core/types";
import { packageName, writeResult } from "./write-result";

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
      "@tanstack/table-core",
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
    expect(result.packages).toEqual(["new-package", "@tanstack/table-core"]);
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
