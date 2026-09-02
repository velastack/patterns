import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hardLinkTree } from "./baseline";

describe("hardLinkTree", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "hard-link-tree-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("hard-links files and recreates symlinks as symlinks", () => {
    const from = path.join(root, "node_modules");
    mkdirSync(path.join(from, "pkg", "dist"), { recursive: true });
    mkdirSync(path.join(from, ".bin"));
    writeFileSync(path.join(from, "pkg", "dist", "index.mjs"), "export {};\n");
    symlinkSync("../pkg/dist/index.mjs", path.join(from, ".bin", "pkg"));

    const to = path.join(root, "clone");
    hardLinkTree(from, to);

    const file = path.join(to, "pkg", "dist", "index.mjs");
    expect(statSync(file).ino).toBe(
      statSync(path.join(from, "pkg", "dist", "index.mjs")).ino,
    );

    const bin = path.join(to, ".bin", "pkg");
    expect(lstatSync(bin).isSymbolicLink()).toBe(true);
    expect(readlinkSync(bin)).toBe("../pkg/dist/index.mjs");
  });
});
