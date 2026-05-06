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
    },
    input: overrides.input ?? {},
  };
}

describe("generate scaffold-remote pattern", () => {
  it("generates schema + CRUD route files with remote forms for new and edit", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        features: {
          auth: true,
          api: false,
          apiKeys: false,
          backend: true,
          i18n: false,
          teams: false,
          payments: false,
          blog: false,
          contentNegotiation: false,
        },
        argv: [
          "contact",
          "name:text!",
          "status:select(draft,published)",
          "owner:current_user",
          "category:relation",
          "attachments:files",
        ],
      }),
    );

    expect(result.creates.map((file) => file.path)).toEqual([
      "src/lib/schemas/contact.ts",
      "src/routes/(app)/contacts/+page.server.ts",
      "src/routes/(app)/contacts/+page.svelte",
      "src/routes/(app)/contacts/new/+page.server.ts",
      "src/routes/(app)/contacts/new/form.remote.ts",
      "src/routes/(app)/contacts/new/+page.svelte",
      "src/routes/(app)/contacts/[id]/+page.server.ts",
      "src/routes/(app)/contacts/[id]/+page.svelte",
      "src/routes/(app)/contacts/[id]/edit/+page.server.ts",
      "src/routes/(app)/contacts/[id]/edit/form.remote.ts",
      "src/routes/(app)/contacts/[id]/edit/+page.svelte",
      "src/routes/(app)/contacts/server.test.ts",
    ]);

    const schemaFile = result.creates.find((file) =>
      file.path.endsWith("src/lib/schemas/contact.ts"),
    );
    const newRemote = result.creates.find((file) =>
      file.path.endsWith("/contacts/new/form.remote.ts"),
    );
    const newPage = result.creates.find((file) =>
      file.path.endsWith("/contacts/new/+page.svelte"),
    );
    const newServer = result.creates.find((file) =>
      file.path.endsWith("/contacts/new/+page.server.ts"),
    );
    const editRemote = result.creates.find((file) =>
      file.path.endsWith("/contacts/[id]/edit/form.remote.ts"),
    );
    const editPage = result.creates.find((file) =>
      file.path.endsWith("/contacts/[id]/edit/+page.svelte"),
    );
    const editServer = result.creates.find((file) =>
      file.path.endsWith("/contacts/[id]/edit/+page.server.ts"),
    );
    const showServer = result.creates.find((file) =>
      file.path.endsWith("/contacts/[id]/+page.server.ts"),
    );
    const scaffoldServerTest = result.creates.find((file) =>
      file.path.endsWith("/contacts/server.test.ts"),
    );

    expect(schemaFile?.content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );

    expect(newRemote?.content).toContain(
      'import { form, getRequestEvent } from "$app/server";',
    );
    expect(newRemote?.content).toContain(
      "export const createContactForm = form(contactSchema,",
    );
    expect(newRemote?.content).toContain(
      "owner: locals.pb.authStore.record?.id",
    );
    expect(newRemote?.content).toContain(
      'locals.pb.collection("contacts").create(',
    );

    expect(newPage?.content).toContain(
      'import { createContactForm } from "./form.remote";',
    );
    expect(newPage?.content).toContain("{...createContactForm}");
    expect(newPage?.content).toContain(
      "createContactForm.fields.name.issues()",
    );
    expect(newPage?.content).toContain('enctype="multipart/form-data"');
    expect(newPage?.content).toContain("New contact");
    expect(newPage?.content).toContain("Back to list");

    expect(newServer?.content).toContain("getFullList()");

    expect(editRemote?.content).toContain(
      "export const updateContactForm = form(contactSchema,",
    );
    expect(editRemote?.content).toContain(
      'locals.pb.collection("contacts").update(id',
    );

    expect(editPage?.content).toContain(
      'import { updateContactForm } from "./form.remote";',
    );
    expect(editPage?.content).toContain(
      '<input type="hidden" name="id" value={data.contact.id} />',
    );

    expect(editServer?.content).toContain(
      'await locals.pb.collection("contacts").getOne(params.id)',
    );
    expect(editServer?.content).not.toContain("superValidate");
    expect(editServer?.content).not.toContain("export const actions");

    expect(showServer?.content).toContain("export const actions");
    expect(showServer?.content).toContain(".delete(params.id)");

    expect(scaffoldServerTest?.content).toContain('describe("GET /contacts"');
    expect(scaffoldServerTest?.content).toContain(
      'describe("GET /contacts/new"',
    );
    expect(scaffoldServerTest?.content).not.toContain(
      'describe("POST /contacts/new"',
    );
    expect(scaffoldServerTest?.content).toContain(
      'describe("POST /contacts/[id]"',
    );
    expect(scaffoldServerTest?.content).not.toContain(
      'describe("POST /contacts/[id]/edit"',
    );

    expect(result.components).toContain("input");
    expect(result.components).toContain("button");
    expect(result.components).not.toContain("form");
    expect(result.components).not.toContain("multiselect");
    expect(result.components).not.toContain("file-form");

    expect(result.collections).toHaveLength(1);
    expect(result.collections[0]).toMatchObject({
      name: "contacts",
      type: "base",
    });
  });

  it("omits new/+page.server.ts when there are no relation fields", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["todo", "title:text!", "done:bool"],
      }),
    );

    expect(
      result.creates
        .map((file) => file.path)
        .includes("src/routes/(public)/todos/new/+page.server.ts"),
    ).toBe(false);

    expect(
      result.creates
        .map((file) => file.path)
        .includes("src/routes/(public)/todos/new/form.remote.ts"),
    ).toBe(true);
  });
});
