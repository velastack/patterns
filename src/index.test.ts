import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExecuteCommand } from "./core/types";
import { installComponents } from "./index";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("installComponents", () => {
  it("installs through the runtime installer", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "patterns-index-"));
    tempDirs.push(root);
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "tmp", dependencies: {} }),
      "utf8",
    );
    const executeCommand = vi.fn<ExecuteCommand>(async () => {});

    const result = await installComponents(
      { root, components: ["data-table"] },
      { executeCommand },
    );

    expect(
      existsSync(
        path.join(
          root,
          "src",
          "lib",
          "components",
          "ui",
          "data-table",
          "index.ts",
        ),
      ),
    ).toBe(true);
    expect(executeCommand).toHaveBeenCalledWith(root, "install", [
      "@tanstack/table-core@^8.21.3",
    ]);
    expect(result).toEqual({
      installed: ["data-table"],
      skipped: [],
      packages: ["@tanstack/table-core@^8.21.3"],
    });
  });
});
