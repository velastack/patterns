import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";

vi.mock("../../../parse/env.runtime", () => {
  return {
    getCollections: async () => [],
  };
});

vi.mock("../../../parse/env.preview", () => {
  return {
    getPreviewCollections: () => [
      {
        id: "users_preview",
        name: "users",
        type: "auth",
        fields: [
          { name: "email", type: "email" },
          { name: "name", type: "text" },
        ],
      },
      {
        id: "categories_preview",
        name: "categories",
        type: "base",
        fields: [{ name: "name", type: "text" }],
      },
    ],
  };
});

function makeOptions(
  overrides: Partial<Options> & Pick<Options, "argv" | "env">,
): Options {
  return {
    argv: overrides.argv,
    env: overrides.env,
    root: "/tmp/project",
    features: overrides.features ?? { auth: false, payments: false },
    input: overrides.input ?? {},
  };
}

describe("generate scaffold pattern", () => {
  it("generates schema + CRUD route files", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        features: { auth: true, payments: false },
        argv: [
          "generate",
          "scaffold",
          "contact",
          "name:text!",
          "status:select(draft,published)",
          "owner:current_user",
          "category:relation",
        ],
      }),
    );

    expect(result.creates.map((file) => file.path)).toEqual([
      "src/lib/schemas/contact.ts",
      "src/routes/(app)/contacts/+page.server.ts",
      "src/routes/(app)/contacts/+page.svelte",
      "src/routes/(app)/contacts/new/+page.server.ts",
      "src/routes/(app)/contacts/new/+page.svelte",
      "src/routes/(app)/contacts/[id]/+page.server.ts",
      "src/routes/(app)/contacts/[id]/+page.svelte",
      "src/routes/(app)/contacts/[id]/edit/+page.server.ts",
      "src/routes/(app)/contacts/[id]/edit/+page.svelte",
      "src/routes/(app)/contacts/server.test.ts",
    ]);

    const listServer = result.creates.find((file) => file.path.endsWith("/contacts/+page.server.ts"));
    const newPage = result.creates.find((file) => file.path.endsWith("/contacts/new/+page.svelte"));
    const showPage = result.creates.find((file) => file.path.endsWith("/contacts/[id]/+page.svelte"));
    const editServer = result.creates.find((file) =>
      file.path.endsWith("/contacts/[id]/edit/+page.server.ts"),
    );
    const scaffoldServerTest = result.creates.find((file) =>
      file.path.endsWith("/contacts/server.test.ts"),
    );

    expect(listServer?.content).toContain('getFullList({ expand: "category" })');
    expect(newPage?.content).toContain("const statusLabels =");
    expect(newPage?.content).toContain('name="category"');
    expect(showPage?.content).toContain("Contact details");
    expect(showPage?.content).toContain("Back to list");
    expect(editServer?.content).toContain("await superValidate(contact, zod(contactSchema))");
    expect(scaffoldServerTest?.content).toContain('describe("GET /contacts"');
    expect(scaffoldServerTest?.content).toContain('describe("POST /contacts/new"');

    expect(result.components).toContain("form");
    expect(result.components).toContain("multiselect");
    expect(result.components).toContain("button");
    expect(result.collections).toHaveLength(1);
    expect(result.collections[0]).toMatchObject({
      name: "contacts",
      type: "base",
    });
    expect(result.collections[0].fields).toEqual(
      expect.arrayContaining([
        { name: "name", type: "text", required: true },
        {
          name: "status",
          type: "select",
          required: false,
          maxSelect: 1,
          values: ["draft", "published"],
        },
        {
          name: "owner",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: "users_preview",
        },
        {
          name: "category",
          type: "relation",
          required: false,
          maxSelect: 1,
          collectionId: "categories_preview",
        },
      ]),
    );
    expect(result.collections[0].listRule).toBeTruthy();
    expect(result.collections[0].createRule).toBe(result.collections[0].listRule);
  });
});
