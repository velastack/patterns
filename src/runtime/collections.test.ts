import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CollectionRulesPatch,
  CollectionSpec,
  Options,
} from "../core/types";
import { applyCollectionRulePatches, createCollections } from "./collections";

// Hoisted because `vi.mock` is itself hoisted above these declarations: the
// factory below runs before a plain `const` has initialized, which fails with
// "Cannot access 'withPocketbaseMock' before initialization".
const { withPocketbaseMock, getMigrationFileMock, migrationDelayMock } =
  vi.hoisted(() => ({
    withPocketbaseMock: vi.fn(),
    getMigrationFileMock: vi.fn(),
    // The real one sleeps 1.1s between migrations so PocketBase orders their
    // filenames distinctly. Nothing here reads the clock, so resolve at once.
    migrationDelayMock: vi.fn(async () => {}),
  }));

const getFirstListItemMock = vi.fn();
const collectionsUpdateMock = vi.fn();

// `vi.mock` replaces the module wholesale, so every binding `collections.ts`
// imports from it has to appear here or it arrives undefined.
vi.mock("./pocketbase", () => ({
  withPocketbase: withPocketbaseMock,
  getMigrationFile: getMigrationFileMock,
  migrationDelay: migrationDelayMock,
}));

function makeOptions(root: string): Options {
  return {
    argv: ["contact", "name:text"],
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
    mkdirSync(path.join(root, "migrations"), { recursive: true });
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
        status: "success",
      },
    ]);
  });

  it("skips a collection that already exists and emits no migration", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-runtime-"));
    tempDirs.push(root);

    const getOneMock = vi.fn().mockResolvedValue({ id: "existing" });
    withPocketbaseMock.mockImplementation(async (_cwd, fn) => {
      await fn({
        collections: {
          create: vi.fn().mockRejectedValue({
            response: {
              data: { name: { code: "validation_collection_name_exists" } },
            },
          }),
          getOne: getOneMock,
        },
      });
    });

    const migrations = await createCollections(
      [{ name: "contacts", type: "base", fields: [] }],
      makeOptions(root),
    );

    // Creating over an existing collection is idempotent, not an error: the
    // existing one is adopted and no migration is recorded, because nothing
    // changed on the server.
    expect(getOneMock).toHaveBeenCalledWith("contacts");
    expect(migrations).toEqual([]);
    expect(getMigrationFileMock).not.toHaveBeenCalled();
  });

  it("rethrows a create failure that is not a name collision", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-runtime-"));
    tempDirs.push(root);

    withPocketbaseMock.mockImplementation(async (_cwd, fn) => {
      await fn({
        collections: {
          create: vi.fn().mockRejectedValue(new Error("connection refused")),
        },
      });
    });

    await expect(
      createCollections(
        [{ name: "contacts", type: "base", fields: [] }],
        makeOptions(root),
      ),
    ).rejects.toThrow("connection refused");
  });
});

describe("applyCollectionRulePatches", () => {
  it("updates collections in patch order and collects migration files", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-rules-"));
    tempDirs.push(root);
    mkdirSync(path.join(root, "migrations"), { recursive: true });
    const migrationPath = path.join(
      root,
      "migrations",
      "0001_updated_teams.js",
    );
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

    const files = await applyCollectionRulePatches(
      pb,
      patches,
      makeOptions(root),
    );

    expect(getFirstListItemMock).toHaveBeenNthCalledWith(1, `name='teams'`);
    expect(getFirstListItemMock).toHaveBeenNthCalledWith(
      2,
      `name='team_memberships'`,
    );
    expect(collectionsUpdateMock).toHaveBeenNthCalledWith(1, "col1", {
      listRule: "a = 1",
    });
    expect(collectionsUpdateMock).toHaveBeenNthCalledWith(2, "col1", {
      viewRule: "b = 2",
    });
    expect(files).toEqual([
      {
        path: migrationPath,
        language: "js",
        content: "updated-migration",
        status: "success",
      },
      {
        path: migrationPath,
        language: "js",
        content: "updated-migration",
        status: "success",
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
