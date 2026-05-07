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

describe("generate scaffold pattern", () => {
  it("generates schema + CRUD route files", async () => {
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
      "src/routes/(app)/contacts/new/+page.svelte",
      "src/routes/(app)/contacts/[id]/+page.server.ts",
      "src/routes/(app)/contacts/[id]/+page.svelte",
      "src/routes/(app)/contacts/[id]/edit/+page.server.ts",
      "src/routes/(app)/contacts/[id]/edit/+page.svelte",
      "src/routes/(app)/contacts/server.test.ts",
    ]);

    const listServer = result.creates.find((file) =>
      file.path.endsWith("/contacts/+page.server.ts"),
    );
    const newPage = result.creates.find((file) =>
      file.path.endsWith("/contacts/new/+page.svelte"),
    );
    const showPage = result.creates.find((file) =>
      file.path.endsWith("/contacts/[id]/+page.svelte"),
    );
    const editServer = result.creates.find((file) =>
      file.path.endsWith("/contacts/[id]/edit/+page.server.ts"),
    );
    const scaffoldServerTest = result.creates.find((file) =>
      file.path.endsWith("/contacts/server.test.ts"),
    );
    const schemaFile = result.creates.find((file) =>
      file.path.endsWith("src/lib/schemas/contact.ts"),
    );

    expect(schemaFile?.content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );
    expect(schemaFile?.content).toContain(
      "'attachments-': z.string().array().optional()",
    );
    expect(schemaFile?.content).toContain("owner: z.string()");
    expect(schemaFile?.content).not.toContain("owner: z.string().optional()");

    expect(listServer?.content).toContain(
      'getFullList({ expand: "category" })',
    );
    expect(newPage?.content).toContain("const statusLabels =");
    expect(newPage?.content).toContain('name="category"');
    expect(newPage?.content).toContain(
      '<input type="hidden" name="owner" value="current_user" />',
    );
    expect(showPage?.content).toContain("Contact details");
    expect(showPage?.content).toContain("Back to list");
    expect(editServer?.content).toContain(
      "await superValidate(contact, zod4(contactSchema))",
    );

    const newServer = result.creates.find((file) =>
      file.path.endsWith("/contacts/new/+page.server.ts"),
    );
    // load() does not seed the form — that slot is for existing record data
    // (edit page only). The current_user sentinel rides on the hidden input.
    expect(newServer?.content).toContain(
      "await superValidate(zod4(contactSchema))",
    );
    expect(newServer?.content).not.toContain('owner: "current_user"');
    expect(newServer?.content).toContain(
      "owner: locals.pb.authStore.record?.id",
    );
    expect(editServer?.content).toContain("owner: contact.owner");

    const editPage = result.creates.find((file) =>
      file.path.endsWith("/contacts/[id]/edit/+page.svelte"),
    );
    expect(editPage?.content).toContain(
      '<input type="hidden" name="owner" bind:value={$formData.owner} />',
    );
    expect(scaffoldServerTest?.content).toContain('describe("GET /contacts"');
    expect(scaffoldServerTest?.content).toContain(
      'describe("POST /contacts/new"',
    );

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
          required: true,
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
    expect(result.collections[0].createRule).toBe(
      result.collections[0].listRule,
    );
  });

  it("emits files at a custom --route with dynamic params", async () => {
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
        argv: ["project", "name:text!"],
        input: { route: "(app)/[team_id]/projects" },
      }),
    );

    expect(result.creates.map((file) => file.path)).toEqual([
      "src/lib/schemas/project.ts",
      "src/routes/(app)/[team_id]/projects/+page.server.ts",
      "src/routes/(app)/[team_id]/projects/+page.svelte",
      "src/routes/(app)/[team_id]/projects/new/+page.server.ts",
      "src/routes/(app)/[team_id]/projects/new/+page.svelte",
      "src/routes/(app)/[team_id]/projects/[id]/+page.server.ts",
      "src/routes/(app)/[team_id]/projects/[id]/+page.svelte",
      "src/routes/(app)/[team_id]/projects/[id]/edit/+page.server.ts",
      "src/routes/(app)/[team_id]/projects/[id]/edit/+page.svelte",
      "src/routes/(app)/[team_id]/projects/server.test.ts",
    ]);

    const listPage = result.creates.find((file) =>
      file.path.endsWith("/projects/+page.svelte"),
    );
    // "New project" button uses Svelte expression with template literal substitution
    expect(listPage?.content).toContain(
      "<Button href={`/${params.team_id}/projects/new`}",
    );

    const showServer = result.creates.find((file) =>
      file.path.endsWith("/projects/[id]/+page.server.ts"),
    );
    // delete redirect interpolates params.team_id
    expect(showServer?.content).toContain(
      "throw redirect(303, `/${params.team_id}/projects`);",
    );

    const editServer = result.creates.find((file) =>
      file.path.endsWith("/projects/[id]/edit/+page.server.ts"),
    );
    // edit redirect chains both team_id and id
    expect(editServer?.content).toContain(
      "redirect(303, `/${params.team_id}/projects/${params.id}`);",
    );

    const newServer = result.creates.find((file) =>
      file.path.endsWith("/projects/new/+page.server.ts"),
    );
    // create redirect chains team_id and the freshly-created project id
    expect(newServer?.content).toContain(
      "return redirect(303, `/${params.team_id}/projects/${project.id}`);",
    );

    const newPage = result.creates.find((file) =>
      file.path.endsWith("/projects/new/+page.svelte"),
    );
    // Cancel button uses dynamic href via Svelte expression
    expect(newPage?.content).toContain(
      "<Button href={`/${params.team_id}/projects`}",
    );

    const showPage = result.creates.find((file) =>
      file.path.endsWith("/projects/[id]/+page.svelte"),
    );
    // Edit href in show page uses Svelte expression with both team_id and data.project.id
    expect(showPage?.content).toContain(
      "<Button href={`/${params.team_id}/projects/${data.project.id}/edit`}",
    );

    const test = result.creates.find((file) =>
      file.path.endsWith("/projects/server.test.ts"),
    );
    // Test URLs substitute placeholder values for dynamic params
    expect(test?.content).toContain(
      "// TODO: customize test fixture values for dynamic route params: team_id",
    );
    expect(test?.content).toContain('describe("GET /test_team_id/projects"');
    expect(test?.content).toContain(
      "agent.get(`/test_team_id/projects/${id}`)",
    );
  });
});
