import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";

const runtimeCollections = async () => [
  {
    id: "contacts",
    name: "contacts",
    type: "base",
    fields: [
      { name: "id", type: "text", system: true },
      { name: "name", type: "text", required: true },
      { name: "avatar", type: "file", maxSelect: 1, required: false },
      {
        name: "attachments",
        type: "file",
        maxSelect: 5,
        required: false,
      },
    ],
  },
];

function makeOptions(
  overrides: Partial<Options> & Pick<Options, "argv" | "env">,
): Options {
  return {
    argv: overrides.argv,
    env: overrides.env,
    getCollections: overrides.getCollections ?? (runtimeCollections as never),
    root: "/tmp/project",
    features: overrides.features ?? {
      auth: false,
      api: false,
      apiKeys: false,
      backend: true,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
      cms: false,
    },
    input: overrides.input ?? {},
  };
}

describe("generate resource pattern", () => {
  it("creates model schema from explicit field args", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["contact", "name:text!", "avatar:file", "attachments:files"],
      }),
    );

    expect(result.creates).toHaveLength(1);
    expect(result.creates[0].path).toBe("src/lib/schemas/contact.ts");
    expect(result.creates[0].content).toContain("id: z.string().optional()");
    expect(result.creates[0].content).toContain(
      "collectionId: z.string().optional()",
    );
    expect(result.creates[0].content).toContain(
      'avatar: z.union([z.instanceof(File), z.string()]).optional().default("")',
    );
    expect(result.creates[0].content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );
    expect(result.creates[0].content).toContain(
      "'attachments-': z.string().array().optional()",
    );
    expect(result.creates[0].content).toContain(
      'satisfies Schemas["contacts"]',
    );
    expect(result.collections).toEqual([
      {
        name: "contacts",
        type: "base",
        fields: [
          { name: "name", type: "text", required: true },
          { name: "avatar", type: "file", required: false, maxSelect: 1 },
          {
            name: "attachments",
            type: "file",
            required: false,
            maxSelect: 99,
          },
          {
            name: "created",
            type: "autodate",
            onCreate: true,
            onUpdate: false,
          },
          { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
        ],
      },
    ]);
    // Collection-level only: the schema never sees them.
    expect(result.creates[0].content).not.toContain("created");
    expect(result.creates[0].content).not.toContain("updated");
  });

  describe("input.rules", () => {
    const generateWith = (rules: unknown, fields: string[], auth = true) =>
      generateBase(
        makeOptions({
          env: "runtime",
          argv: ["ticket", ...fields],
          features: {
            ...{
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
            },
            auth,
          },
          getCollections: (async () => [
            { id: "users_id", name: "users", type: "auth", fields: [] },
          ]) as never,
          input: { rules },
        }),
      );
    const rulesOf = (result: Awaited<ReturnType<typeof generateBase>>) => {
      const { listRule, viewRule, createRule, updateRule, deleteRule } =
        result.collections[0];
      return [listRule, viewRule, createRule, updateRule, deleteRule];
    };
    const signedIn = '@request.auth.id != ""';
    const owner = "@request.auth.id = user.id";

    it("unset: owner when a path to users exists, signed-in otherwise", async () => {
      expect(
        rulesOf(await generateWith(undefined, ["user:current_user"])),
      ).toEqual(Array(5).fill(owner));
      expect(rulesOf(await generateWith(undefined, ["code:text"]))).toEqual(
        Array(5).fill(signedIn),
      );
      expect(
        rulesOf(await generateWith(undefined, ["code:text"], false)),
      ).toEqual(Array(5).fill(undefined));
    });

    it("auth: signed-in on all five, even with an owner path", async () => {
      const result = await generateWith("auth", ["user:current_user"]);
      expect(rulesOf(result)).toEqual(Array(5).fill(signedIn));
      expect(result.notes).toEqual([]);
    });

    it("owner: the inferred rule, and an error without a path", async () => {
      expect(
        rulesOf(await generateWith("owner", ["user:current_user"])),
      ).toEqual(Array(5).fill(owner));
      await expect(generateWith("owner", ["code:text"])).rejects.toThrow(
        /Rules "owner" need a relation from "tickets" to users/,
      );
    });

    it("superuser: null rules and a note about the admin client", async () => {
      const result = await generateWith("superuser", ["user:current_user"]);
      expect(rulesOf(result)).toEqual(Array(5).fill(null));
      expect(result.notes).toEqual([
        expect.stringMatching(
          /"tickets".*only the superuser client.*locals\.admin/,
        ),
      ]);
    });

    it("rejects an unknown value and auth rules without auth", async () => {
      await expect(generateWith("public", ["code:text"])).rejects.toThrow(
        'Invalid rules: "public". Valid values are: auth, owner, superuser',
      );
      await expect(generateWith("auth", ["code:text"], false)).rejects.toThrow(
        /need the auth feature/,
      );
    });
  });

  it("creates a unique index for a field declared :unique", async () => {
    const result = await generateBase(
      makeOptions({
        env: "runtime",
        argv: ["ticket", "code:text!:unique", "title:text"],
        getCollections: (async () => []) as never,
      }),
    );
    expect(result.collections[0].indexes).toEqual([
      "CREATE UNIQUE INDEX `idx_tickets_code` ON `tickets` (`code`)",
    ]);
    expect(result.creates[0].content).toContain("code: z.string().nonempty()");
  });
});
