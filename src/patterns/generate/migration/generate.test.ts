import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";

const mockCollections = [
  {
    id: "posts_id",
    name: "posts",
    type: "base",
    fields: [
      { name: "id", type: "text", system: true },
      { name: "title", type: "text", required: true },
      { name: "legacy_flag", type: "bool" },
    ],
  },
  {
    id: "users_id",
    name: "users",
    type: "auth",
    fields: [
      { name: "id", type: "text", system: true },
      { name: "email", type: "email", required: true },
    ],
  },
];

vi.mock("../../../parse/env.runtime", () => ({
  getCollections: async () => mockCollections,
}));

vi.mock("../../../parse/env.preview", () => ({
  getPreviewCollections: () => mockCollections,
}));

function makeOptions(
  overrides: Partial<Options> & Pick<Options, "argv" | "env">,
): Options {
  return {
    argv: overrides.argv,
    env: overrides.env,
    root: "/tmp/project",
    features: overrides.features ?? {
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
    input: overrides.input ?? {},
  };
}

describe("generate migration pattern", () => {
  describe("add", () => {
    it("emits one add change per field def", async () => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          argv: ["posts", "add", "body:editor", "published:bool"],
        }),
      );

      expect(result.collectionPatches).toHaveLength(1);
      const patch = result.collectionPatches[0];
      expect(patch.collectionName).toBe("posts");
      expect(patch.changes).toHaveLength(2);
      expect(patch.changes[0]).toEqual({
        op: "add",
        field: expect.objectContaining({
          name: "body",
          type: "editor",
          required: false,
        }),
      });
      expect(patch.changes[1]).toEqual({
        op: "add",
        field: expect.objectContaining({
          name: "published",
          type: "bool",
          required: false,
        }),
      });
    });

    it("supports relation shorthand in add", async () => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          argv: ["posts", "add", "author:users"],
        }),
      );

      const change = result.collectionPatches[0].changes[0];
      expect(change).toEqual({
        op: "add",
        field: expect.objectContaining({
          name: "author",
          type: "relation",
          collectionId: "users_id",
          maxSelect: 1,
        }),
      });
    });

    it("rejects adding a field that already exists", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "preview",
            argv: ["posts", "add", "title:text"],
          }),
        ),
      ).rejects.toThrow(/already exists/);
    });

    it("requires at least one field definition", async () => {
      await expect(
        generateBase(makeOptions({ env: "preview", argv: ["posts", "add"] })),
      ).rejects.toThrow(/at least one field definition/);
    });
  });

  describe("remove", () => {
    it("emits one remove change per field name", async () => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          argv: ["posts", "remove", "title", "legacy_flag"],
        }),
      );

      expect(result.collectionPatches[0].changes).toEqual([
        { op: "remove", fieldName: "title" },
        { op: "remove", fieldName: "legacy_flag" },
      ]);
    });

    it("rejects removing a field that does not exist", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "preview",
            argv: ["posts", "remove", "nope"],
          }),
        ),
      ).rejects.toThrow(/does not exist/);
    });

    it("requires at least one field name", async () => {
      await expect(
        generateBase(
          makeOptions({ env: "preview", argv: ["posts", "remove"] }),
        ),
      ).rejects.toThrow(/at least one field name/);
    });
  });

  describe("rename", () => {
    it("emits a single rename change", async () => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          argv: ["posts", "rename", "title", "heading"],
        }),
      );

      expect(result.collectionPatches[0].changes).toEqual([
        { op: "rename", from: "title", to: "heading" },
      ]);
    });

    it("rejects when source field does not exist", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "preview",
            argv: ["posts", "rename", "nope", "heading"],
          }),
        ),
      ).rejects.toThrow(/does not exist/);
    });

    it("rejects when target field already exists", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "preview",
            argv: ["posts", "rename", "title", "legacy_flag"],
          }),
        ),
      ).rejects.toThrow(/already exists/);
    });

    it("requires exactly two arguments", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "preview",
            argv: ["posts", "rename", "title"],
          }),
        ),
      ).rejects.toThrow(/exactly two arguments/);
    });
  });

  describe("references", () => {
    it("plural target produces multi-relation field named after the target", async () => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          argv: ["posts", "references", "users"],
        }),
      );

      expect(result.collectionPatches[0].changes).toEqual([
        {
          op: "add",
          field: expect.objectContaining({
            name: "users",
            type: "relation",
            collectionId: "users_id",
            maxSelect: 999,
          }),
        },
      ]);
    });

    it("singular target produces single-relation field", async () => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          argv: ["posts", "references", "user"],
        }),
      );

      expect(result.collectionPatches[0].changes).toEqual([
        {
          op: "add",
          field: expect.objectContaining({
            name: "user",
            type: "relation",
            collectionId: "users_id",
            maxSelect: 1,
          }),
        },
      ]);
    });

    it("rejects unknown target collection", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "preview",
            argv: ["posts", "references", "ghosts"],
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("validation", () => {
    it("rejects unknown op", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "preview",
            argv: ["posts", "drop", "title"],
          }),
        ),
      ).rejects.toThrow(/Invalid op/);
    });

    it("rejects unknown collection", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "preview",
            argv: ["ghosts", "add", "title:text"],
          }),
        ),
      ).rejects.toThrow(/not found/);
    });

    it("requires collection and op", async () => {
      await expect(
        generateBase(makeOptions({ env: "preview", argv: ["posts"] })),
      ).rejects.toThrow(/Invalid command arguments/);
    });
  });
});
