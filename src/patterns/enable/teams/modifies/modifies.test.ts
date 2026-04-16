import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modifyLayoutServer } from "./+layout.server";
import { modifyAppLayoutSvelte } from "./modify-app-layout";
import { modifyAppSidebar } from "./modify-app-sidebar";
import { modifyNavUser } from "./modify-nav-user";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, "");
}

const modifyCases = [
  {
    file: "+layout.server.ts",
    modify: modifyLayoutServer,
  },
  {
    file: "+layout.svelte",
    modify: modifyAppLayoutSvelte,
  },
  {
    file: "app-sidebar.svelte",
    modify: modifyAppSidebar,
  },
  {
    file: "nav-user.svelte",
    modify: modifyNavUser,
  },
] as const;

describe("teams modifies (auth baseline fixtures)", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(modifyCases)("should modify $file correctly", ({ file, modify }) => {
    const targetPath = path.join(tempDir, file);
    modify(targetPath);

    const modifiedFile = fs.readFileSync(targetPath, "utf8");
    const expectedFile = fs.readFileSync(
      path.join(fixturesPath, "expect", file),
      "utf8",
    );

    expect(normalizeWhitespace(modifiedFile)).toBe(
      normalizeWhitespace(expectedFile),
    );
  });
});
