import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { POCKETBASE_BIN_ENV } from "../core/constants";
import { pocketbaseCommand } from "./pocketbase";

const tempDirs: string[] = [];

/** A project whose lockfile names its package manager. */
function makeProject(lockfile: string) {
  const root = mkdtempSync(path.join(os.tmpdir(), "patterns-pocketbase-"));
  tempDirs.push(root);
  writeFileSync(path.join(root, "package.json"), "{}", "utf8");
  writeFileSync(path.join(root, lockfile), "", "utf8");
  return root;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const SERVE = ["serve", "--dir", "/p/data", "--http", "localhost:8090"];

describe("pocketbaseCommand", () => {
  it("is called VELA_POCKETBASE_BIN", () => {
    expect(POCKETBASE_BIN_ENV).toBe("VELA_POCKETBASE_BIN");
  });

  it("runs the named binary directly, whatever the package manager", async () => {
    const root = makeProject("pnpm-lock.yaml");
    // Any file that exists stands in for the binary; nothing is spawned.
    const bin = path.join(root, "pocketbase");
    writeFileSync(bin, "", "utf8");

    expect(
      await pocketbaseCommand(root, SERVE, { VELA_POCKETBASE_BIN: bin }),
    ).toEqual({ command: bin, args: SERVE });
  });

  it("goes through npx in an npm project when the variable is not set", async () => {
    const root = makeProject("package-lock.json");

    expect(await pocketbaseCommand(root, SERVE, {})).toEqual({
      command: "npx",
      args: ["--yes", "pocketbase-server", ...SERVE],
    });
    // Empty is unset: a CLI that could not resolve the binary exports "".
    expect(
      await pocketbaseCommand(root, SERVE, { VELA_POCKETBASE_BIN: "" }),
    ).toEqual({
      command: "npx",
      args: ["--yes", "pocketbase-server", ...SERVE],
    });
  });

  it("goes through pnpm dlx in a pnpm project when the variable is not set", async () => {
    const root = makeProject("pnpm-lock.yaml");

    expect(await pocketbaseCommand(root, SERVE, {})).toEqual({
      command: "pnpm",
      args: ["dlx", "pocketbase-server", ...SERVE],
    });
  });

  it("reads process.env by default", async () => {
    const root = makeProject("package-lock.json");
    const bin = path.join(root, "pocketbase");
    writeFileSync(bin, "", "utf8");
    const before = process.env.VELA_POCKETBASE_BIN;
    process.env.VELA_POCKETBASE_BIN = bin;
    try {
      expect((await pocketbaseCommand(root, SERVE)).command).toBe(bin);
    } finally {
      if (before === undefined) delete process.env.VELA_POCKETBASE_BIN;
      else process.env.VELA_POCKETBASE_BIN = before;
    }
  });

  it("refuses a relative path or a missing file instead of falling back", async () => {
    const root = makeProject("package-lock.json");

    await expect(
      pocketbaseCommand(root, SERVE, { VELA_POCKETBASE_BIN: "bin/pocketbase" }),
    ).rejects.toThrow(
      'VELA_POCKETBASE_BIN must be an absolute path to the PocketBase binary; it is "bin/pocketbase".',
    );
    const missing = path.join(root, "nowhere", "pocketbase");
    await expect(
      pocketbaseCommand(root, SERVE, { VELA_POCKETBASE_BIN: missing }),
    ).rejects.toThrow(
      `VELA_POCKETBASE_BIN points at ${missing}, which does not exist.`,
    );
  });
});
