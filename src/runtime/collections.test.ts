import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollectionRulesPatch, CollectionSpec, Options } from "../core/types";
import { applyCollectionRulePatches, createCollections } from "./collections";

const withPocketbaseMock = vi.fn();
const getMigrationFileMock = vi.fn();

const getFirstListItemMock = vi.fn();
const collectionsUpdateMock = vi.fn();

vi.mock("./pocketbase", () => ({
  withPocketbase: withPocketbaseMock,
  getMigrationFile: getMigrationFileMock,
}));

function makeOptions(root: string): Options {
  return {
    argv: ["contact", "name:text"],
    env: "runtime",
    root,
    features: { auth: false, api: false, payments: false },
    input: {},
  };
}

const tempDirs: string[] = [];

afterEach(() => {
  vi.clearAllMocks();
  getFirstListItemMock.mockReset();
  collectionsUpdateMock.mockReset();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("createCollections", () => {
  it("creates collections and appends created migration files", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-runtime-"));
    tempDirs.push(root);
    const migrationPath = path.join(
      root,
      "migrations",
      "0001_created_contacts.js",
    );
    writeFileSync(migrationPath, "migration-content", "utf8");

    const createMock = vi.fn().mockResolvedValue(undefined);
    withPocketbaseMock.mockImplementation(async (_cwd, fn) => {
      await fn({ collections: { create: createMock } });
    });
    getMigrationFileMock
      .mockReturnValueOnce(migrationPath)
      .mockReturnValue(undefined);

    const collections: CollectionSpec[] = [
      {
        name: "contacts",
        type: "base",
        fields: [{ name: "name", type: "text", required: true }],
      },
    ];

    const migrations = await createCollections(collections, makeOptions(root));

    expect(withPocketbaseMock).toHaveBeenCalledWith(root, expect.any(Function));
    expect(createMock).toHaveBeenCalledWith(collections[0]);
    expect(getMigrationFileMock).toHaveBeenCalledWith(
      "contacts",
      "created",
      expect.objectContaining({ root }),
    );
    expect(migrations).toEqual([
      {
        path: migrationPath,
        language: "js",
        content: "migration-content",
      },
    ]);
  });

  it("throws a clear error when collection already exists", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-runtime-"));
    tempDirs.push(root);

    withPocketbaseMock.mockImplementation(async (_cwd, fn) => {
      await fn({
        collections: {
          create: vi.fn().mockRejectedValue({
            response: { data: { name: { code: "validation_not_unique" } } },
          }),
        },
      });
    });

    await expect(
      createCollections(
        [{ name: "contacts", type: "base", fields: [] }],
        makeOptions(root),
      ),
    ).rejects.toThrow(
      'Collection "contacts" already exists. Choose a different model name or remove the existing collection first.',
    );
  });
});

describe("applyCollectionRulePatches", () => {
  it("updates collections in patch order and collects migration files", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-rules-"));
    tempDirs.push(root);
    const migrationPath = path.join(root, "migrations", "0001_updated_teams.js");
    writeFileSync(migrationPath, "updated-migration", "utf8");

    getFirstListItemMock.mockResolvedValue({ id: "col1" });
    collectionsUpdateMock.mockResolvedValue(undefined);
    getMigrationFileMock.mockReturnValue(migrationPath);

    const patches: CollectionRulesPatch[] = [
      { collectionName: "teams", listRule: "a = 1" },
      { collectionName: "team_memberships", viewRule: "b = 2" },
    ];

    const pb = {
      collections: {
        getFirstListItem: getFirstListItemMock,
        update: collectionsUpdateMock,
      },
    };

    const files = await applyCollectionRulePatches(pb, patches, makeOptions(root));

    expect(getFirstListItemMock).toHaveBeenNthCalledWith(1, `name='teams'`);
    expect(getFirstListItemMock).toHaveBeenNthCalledWith(2, `name='team_memberships'`);
    expect(collectionsUpdateMock).toHaveBeenNthCalledWith(1, "col1", { listRule: "a = 1" });
    expect(collectionsUpdateMock).toHaveBeenNthCalledWith(2, "col1", { viewRule: "b = 2" });
    expect(files).toEqual([
      {
        path: migrationPath,
        language: "js",
        content: "updated-migration",
      },
      {
        path: migrationPath,
        language: "js",
        content: "updated-migration",
      },
    ]);
  });

  it("escapes single quotes in collection names for filters", async () => {
    getFirstListItemMock.mockResolvedValue({ id: "x" });
    collectionsUpdateMock.mockResolvedValue(undefined);

    await applyCollectionRulePatches(
      {
        collections: {
          getFirstListItem: getFirstListItemMock,
          update: collectionsUpdateMock,
        },
      },
      [{ collectionName: "a'b", listRule: "x" }],
    );

    expect(getFirstListItemMock).toHaveBeenCalledWith(`name='a''b'`);
  });
});
