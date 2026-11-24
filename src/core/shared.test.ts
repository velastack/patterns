import { describe, expect, it } from "vitest";
import type { Field } from "../parse";
import { parseModel } from "../parse/model";
import {
  collectionSpecFromModelFields,
  fieldsFromCollection,
  generateSchemaSnippet,
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
