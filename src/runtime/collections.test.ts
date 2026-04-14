import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CollectionSpec, Options } from "../core/types";
import { createCollections } from "./collections";

const withPocketbaseMock = vi.fn();
const getMigrationFileMock = vi.fn();

vi.mock("./pocketbase", () => ({
  withPocketbase: withPocketbaseMock,
  getMigrationFile: getMigrationFileMock,
}));

function makeOptions(root: string): Options {
  return {
    argv: ["generate", "resource", "contact", "name:text"],
    env: "runtime",
    root,
    features: { auth: false, payments: false },
    input: {},
  };
}

const tempDirs: string[] = [];

afterEach(() => {
  vi.clearAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()!;
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("createCollections", () => {
  it("creates collections and appends created migration files", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "collections-runtime-"));
    tempDirs.push(root);
    const migrationPath = path.join(root, "migrations", "0001_created_contacts.js");
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
