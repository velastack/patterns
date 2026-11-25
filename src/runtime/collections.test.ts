import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CollectionRulesPatch,
  CollectionSpec,
  Options,
} from "../core/types";
import {
  applyCollectionFieldsPatches,
  applyCollectionRulePatches,
  createCollections,
  readMigration,
} from "./collections";

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

function writeMigration(root: string, name: string, content: string): string {
  const file = path.join(root, "migrations", name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, "utf8");
  return file;
}

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
    // PocketBase's own style: tabs, no trailing newline.
    writeFileSync(migrationPath, "migrate((app) => {\n\treturn 1\n})", "utf8");

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
    // Formatted where PocketBase left it, so a run that fails before
    // `writeResult` still leaves a file `prettier --check` accepts.
    const formatted = "migrate((app) => {\n  return 1;\n});\n";
    expect(readFileSync(migrationPath, "utf8")).toBe(formatted);
    expect(migrations).toEqual([
      {
        path: migrationPath,
        language: "js",
        content: formatted,
        status: "success",
        written: true,
      },
    ]);
  });

  it("does not mark a migration it had no need to rewrite", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-runtime-"));
    tempDirs.push(root);
    const formatted = "migrate((app) => {\n  return 1;\n});\n";
    const first = await readMigration(
      writeMigration(root, "1_created_a.js", "migrate((app) => {return 1})"),
      makeOptions(root),
    );
    expect(first.written).toBe(true);
    expect(first.content).toBe(formatted);

    // The same file read back again (an earlier run's, or twice in one run).
    const again = await readMigration(first.path, makeOptions(root));
    expect(again).toEqual({
      path: first.path,
      language: "js",
      content: formatted,
      status: "success",
    });
  });

  it("swaps relation targets named by collection for their ids", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-runtime-"));
    tempDirs.push(root);

    const createMock = vi.fn().mockResolvedValue(undefined);
    const getFullListMock = vi.fn().mockResolvedValue([
      { id: "_pb_users_auth_", name: "users" },
      { id: "pbc_customers", name: "stripe_customers" },
    ]);
    withPocketbaseMock.mockImplementation(async (_cwd, fn) => {
      await fn({
        collections: { create: createMock, getFullList: getFullListMock },
      });
    });
    getMigrationFileMock.mockReturnValue(undefined);

    const collections: CollectionSpec[] = [
      {
        name: "subscriptions",
        type: "base",
        fields: [
          {
            name: "user",
            type: "relation",
            required: true,
            collectionId: "_pb_users_auth_",
          },
          {
            name: "customer",
            type: "relation",
            required: true,
            collectionId: "stripe_customers",
          },
          { name: "status", type: "text", required: false },
        ],
      },
    ];

    await createCollections(collections, makeOptions(root));

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].fields).toEqual([
      expect.objectContaining({
        name: "user",
        collectionId: "_pb_users_auth_",
      }),
      expect.objectContaining({
        name: "customer",
        collectionId: "pbc_customers",
      }),
      expect.objectContaining({ name: "status", type: "text" }),
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
    // Both patches read back the one file the mock names: the first formats
    // it, the second finds it formatted.
    const content = "updated - migration;\n";
    expect(files).toEqual([
      {
        path: migrationPath,
        language: "js",
        content,
        status: "success",
        written: true,
      },
      { path: migrationPath, language: "js", content, status: "success" },
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

describe("applyCollectionFieldsPatches", () => {
  const field = { name: "code", type: "text", required: true };
  const index = "CREATE UNIQUE INDEX `idx_songs_code` ON `songs` (`code`)";

  function pocketbase(indexes?: string[]) {
    const update = vi.fn().mockResolvedValue(undefined);
    const pb = {
      collections: {
        getOne: vi.fn().mockResolvedValue({ id: "col1", fields: [], indexes }),
        update,
      },
    };
    return { pb, update };
  }

  it("adds a patch's indexes to the ones the collection has", async () => {
    getMigrationFileMock.mockReturnValue(undefined);
    const existing = "CREATE INDEX `idx_songs_title` ON `songs` (`title`)";
    const { pb, update } = pocketbase([existing]);

    await applyCollectionFieldsPatches(
      pb,
      [
        {
          collectionName: "songs",
          changes: [{ op: "add", field }],
          indexes: [index, existing],
        },
      ],
      makeOptions("/tmp/project"),
    );

    expect(update).toHaveBeenCalledWith("col1", {
      fields: [field],
      indexes: [existing, index],
    });
  });

  it("sends no indexes for a patch without any", async () => {
    getMigrationFileMock.mockReturnValue(undefined);
    const { pb, update } = pocketbase(["CREATE INDEX `a` ON `songs` (`b`)"]);

    await applyCollectionFieldsPatches(
      pb,
      [{ collectionName: "songs", changes: [{ op: "add", field }] }],
      makeOptions("/tmp/project"),
    );

    expect(update).toHaveBeenCalledWith("col1", { fields: [field] });
  });
});
