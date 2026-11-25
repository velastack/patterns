import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Options } from "../core/types";
import { bySlug, type Slug } from "../index";
import { registryFetch } from "./registry.mock";

/*
 * A pattern that creates collections has PocketBase write a migration file
 * for each one, before `writeResult` is reached. These run each such pattern
 * against a registry that lists nothing, and check it stops before it starts
 * PocketBase at all.
 */

const pocketbase = vi.hoisted(() => ({ started: 0 }));

vi.mock("./pocketbase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./pocketbase")>()),
  withPocketbase: async () => {
    pocketbase.started += 1;
    throw new Error(
      "PocketBase was started before the components were checked",
    );
  },
}));

const FEATURES = {
  auth: true,
  api: false,
  apiKeys: false,
  backend: true,
  i18n: false,
  teams: false,
  payments: false,
  blog: false,
  contentNegotiation: false,
  cms: false,
};

const tempDirs: string[] = [];

function makeProject() {
  const root = mkdtempSync(path.join(os.tmpdir(), "patterns-preflight-"));
  tempDirs.push(root);
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "tmp", dependencies: {} }),
    "utf8",
  );
  writeFileSync(
    path.join(root, "components.json"),
    JSON.stringify({ style: "vega" }),
    "utf8",
  );
  return root;
}

afterEach(() => {
  vi.unstubAllGlobals();
  pocketbase.started = 0;
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

const CASES: [Slug, string[], Partial<Options>][] = [
  ["enable-auth", [], {}],
  ["enable-auth-remote", [], {}],
  ["enable-api-keys", [], {}],
  ["enable-teams", [], {}],
  ["enable-payments", ["--provider", "stripe"], {}],
  ["generate-scaffold", ["posts", "title:text"], {}],
  ["generate-scaffold-remote", ["posts", "title:text"], {}],
];

describe("patterns that create collections", () => {
  it.each(CASES)(
    "%s checks its components before PocketBase is started",
    async (slug, argv, overrides) => {
      const root = makeProject();
      vi.stubGlobal("fetch", registryFetch([]));
      const before = readdirSync(root).sort();

      await expect(
        bySlug[slug].generate({
          argv,
          env: "runtime",
          root,
          features: FEATURES,
          input: {},
          getCollections: async () => [],
          ...overrides,
        } as Options),
      ).rejects.toThrow(/Unknown components? "/);

      expect(pocketbase.started).toBe(0);
      expect(readdirSync(root).sort()).toEqual(before);
      expect(existsSync(path.join(root, "migrations"))).toBe(false);
    },
  );
});
