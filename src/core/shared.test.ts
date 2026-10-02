import { describe, expect, it } from "vitest";
import type { Field } from "../parse";
import { parseModel } from "../parse/model";
import { generateSchemaSnippet } from "./shared";

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
