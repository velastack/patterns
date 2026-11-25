import { describe, expect, it } from "vitest";
import type { Field } from "../parse";
import { parseModel } from "../parse/model";
import {
  collectionSpecFromModelFields,
  fieldsFromCollection,
  generateSchemaSnippet,
  rulesModeForCreate,
  rulesModeFromInput,
  rulesNotes,
} from "./shared";

const model = parseModel("post");

const fields: Field[] = [
  { name: "title", title: "Title", type: "text", required: true },
  { name: "meta", title: "Meta", type: "json", required: false },
  { name: "settings", title: "Settings", type: "json", required: true },
];

describe("generateSchemaSnippet", () => {
  it("types json as a string in a remote form, so `fields.x.as()` exists", () => {
    const schema = generateSchemaSnippet(model, fields, {
      includeModelFields: false,
      forForm: true,
      remote: true,
    });
    expect(schema).toContain("meta: z.string().optional()");
    expect(schema).toMatch(/settings: z\.string\(\)$/m);
    expect(schema).not.toContain("z.any()");
  });

  it("keeps json as z.any() for superforms", () => {
    const schema = generateSchemaSnippet(model, fields, {
      includeModelFields: false,
      forForm: true,
    });
    expect(schema).toContain("meta: z.any().optional()");
    expect(schema).toMatch(/settings: z\.any\(\)$/m);
  });

  it("leaves every other field type alone", () => {
    const options = { includeModelFields: true, forForm: true };
    const superforms = generateSchemaSnippet(model, [fields[0]], options);
    const remote = generateSchemaSnippet(model, [fields[0]], {
      ...options,
      remote: true,
    });
    expect(remote).toBe(superforms);
    expect(remote).toContain("title: z.string().nonempty()");
  });
});

const noFeatures = {
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
};

describe("collectionSpecFromModelFields", () => {
  const created = {
    name: "created",
    type: "autodate",
    onCreate: true,
    onUpdate: false,
  };
  const updated = {
    name: "updated",
    type: "autodate",
    onCreate: true,
    onUpdate: true,
  };

  it("appends created and updated autodate fields", () => {
    const spec = collectionSpecFromModelFields(model, [fields[0]]);
    expect(spec.fields).toEqual([
      { name: "title", type: "text", required: true },
      created,
      updated,
    ]);
  });

  it("keeps a field the user named created or updated as declared", () => {
    const spec = collectionSpecFromModelFields(model, [
      { name: "created", title: "Created", type: "date", required: true },
      {
        name: "updated",
        title: "Updated",
        type: "autodate",
        required: false,
        onCreate: false,
        onUpdate: true,
      },
    ]);
    expect(spec.fields).toEqual([
      { name: "created", type: "date", required: true },
      {
        name: "updated",
        type: "autodate",
        required: false,
        onCreate: false,
        onUpdate: true,
      },
    ]);
  });
});

describe("fieldsFromCollection", () => {
  const collection = (extra: object[]) => [
    {
      id: "posts_id",
      name: "posts",
      type: "base" as const,
      fields: [
        { name: "id", type: "text", system: true },
        { name: "title", type: "text", required: true },
        ...extra,
      ],
    },
  ];

  it("leaves out the collection's created and updated autodate fields", () => {
    const resolved = fieldsFromCollection(
      model,
      collection([
        { name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ]) as never,
      { features: noFeatures },
    );
    expect(resolved.map((field) => field.name)).toEqual(["title"]);
  });

  it("keeps other autodate fields, and a created field of another type", () => {
    const resolved = fieldsFromCollection(
      model,
      collection([
        { name: "created", type: "date" },
        { name: "publishedUpdate", type: "autodate" },
      ]) as never,
      { features: noFeatures },
    );
    expect(resolved.map((field) => field.name)).toEqual([
      "title",
      "created",
      "publishedUpdate",
    ]);
    expect(resolved[2]).toMatchObject({ onCreate: true, onUpdate: true });
  });
});

describe("collection rules", () => {
  const title: Field = {
    name: "title",
    title: "Title",
    type: "text",
    required: true,
  };
  const signedIn = '@request.auth.id != ""';
  const owner = {
    rule: "@request.auth.id = user.id",
    ownershipChainCollections: ["posts", "users"],
    ownershipChainFields: ["user"],
    operator: "=" as const,
  };
  const noOwner = {
    rule: signedIn,
    ownershipChainCollections: ["posts"],
    ownershipChainFields: [],
    operator: "=" as const,
  };
  const rulesOf = (spec: ReturnType<typeof collectionSpecFromModelFields>) => ({
    listRule: spec.listRule,
    viewRule: spec.viewRule,
    createRule: spec.createRule,
    updateRule: spec.updateRule,
    deleteRule: spec.deleteRule,
  });
  const all = (rule: string | null | undefined) => ({
    listRule: rule,
    viewRule: rule,
    createRule: rule,
    updateRule: rule,
    deleteRule: rule,
  });

  it("unset: the inferred rule, or none without auth", () => {
    expect(
      rulesOf(collectionSpecFromModelFields(model, [title], owner)),
    ).toEqual(all(owner.rule));
    expect(
      rulesOf(collectionSpecFromModelFields(model, [title], noOwner)),
    ).toEqual(all(signedIn));
    const spec = collectionSpecFromModelFields(model, [title]);
    expect(spec).not.toHaveProperty("listRule");
    expect(spec).not.toHaveProperty("deleteRule");
  });

  it("auth: any signed-in user, even with an owner path", () => {
    expect(
      rulesOf(collectionSpecFromModelFields(model, [title], owner, "auth")),
    ).toEqual(all(signedIn));
  });

  it("owner: the inferred owner rule", () => {
    expect(
      rulesOf(collectionSpecFromModelFields(model, [title], owner, "owner")),
    ).toEqual(all(owner.rule));
  });

  it("owner: an error when no relation leads to users", () => {
    expect(() =>
      collectionSpecFromModelFields(model, [title], noOwner, "owner"),
    ).toThrow(/Rules "owner" need a relation from "posts" to users/);
  });

  it("superuser: all five rules null, with or without auth", () => {
    expect(
      rulesOf(
        collectionSpecFromModelFields(model, [title], owner, "superuser"),
      ),
    ).toEqual(all(null));
    expect(
      rulesOf(
        collectionSpecFromModelFields(model, [title], undefined, "superuser"),
      ),
    ).toEqual(all(null));
  });

  it("says a superuser-only collection needs the admin client", () => {
    expect(rulesNotes(model, "superuser")).toEqual([
      expect.stringContaining("locals.admin"),
    ]);
    expect(rulesNotes(model, "auth")).toEqual([]);
    expect(rulesNotes(model, undefined)).toEqual([]);
  });

  describe("input.rules", () => {
    const auth = { ...noFeatures, auth: true };

    it("is optional", () => {
      expect(rulesModeFromInput({ features: auth, input: {} })).toBeUndefined();
    });

    it("takes auth, owner and superuser", () => {
      for (const rules of ["auth", "owner", "superuser"] as const) {
        expect(rulesModeFromInput({ features: auth, input: { rules } })).toBe(
          rules,
        );
      }
    });

    it("rejects anything else, listing the valid values", () => {
      expect(() =>
        rulesModeFromInput({ features: auth, input: { rules: "public" } }),
      ).toThrow(
        'Invalid rules: "public". Valid values are: auth, owner, superuser',
      );
    });

    it("refuses auth and owner in a project without auth", () => {
      for (const rules of ["auth", "owner"]) {
        expect(() =>
          rulesModeFromInput({ features: noFeatures, input: { rules } }),
        ).toThrow(/need the auth feature/);
      }
      expect(
        rulesModeFromInput({
          features: noFeatures,
          input: { rules: "superuser" },
        }),
      ).toBe("superuser");
    });

    it("refuses rules when no collection is created", () => {
      expect(() =>
        rulesModeForCreate(
          { features: auth, input: { rules: "auth" } },
          model,
          false,
        ),
      ).toThrow(/"posts" is not being created/);
      expect(
        rulesModeForCreate({ features: auth, input: {} }, model, false),
      ).toBeUndefined();
    });
  });
});

describe("unique indexes", () => {
  it("puts one CREATE UNIQUE INDEX per unique field on the spec", () => {
    const spec = collectionSpecFromModelFields(model, [
      {
        name: "code",
        title: "Code",
        type: "text",
        required: true,
        unique: true,
      },
      { name: "title", title: "Title", type: "text", required: true },
      {
        name: "slug",
        title: "Slug",
        type: "text",
        required: false,
        unique: true,
      },
    ]);
    expect(spec.indexes).toEqual([
      "CREATE UNIQUE INDEX `idx_posts_code` ON `posts` (`code`)",
      "CREATE UNIQUE INDEX `idx_posts_slug` ON `posts` (`slug`)",
    ]);
    // `unique` is the index, not a property of the PocketBase field.
    expect(spec.fields[0]).toEqual({
      name: "code",
      type: "text",
      required: true,
    });
  });

  it("leaves indexes off a spec without unique fields", () => {
    expect(
      collectionSpecFromModelFields(model, [fields[0]]),
    ).not.toHaveProperty("indexes");
  });
});
