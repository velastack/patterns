import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";

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
      {
        id: "workspaces_preview",
        name: "workspaces",
        type: "base",
        fields: [
          { name: "name", type: "text" },
          {
            name: "owner",
            type: "relation",
            collectionId: "users_preview",
            maxSelect: 1,
            required: true,
          },
        ],
      },
    ],
  };
});

const runtimeCollections = async () => [];

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
          cms: false,
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
    // redirect() throws, so inside the try the catch would turn a successful
    // update into fail(400).
    const editContent = editServer?.content ?? "";
    expect(editContent.indexOf("redirect(303")).toBeGreaterThan(
      editContent.indexOf("} catch (error)"),
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
    // A Svelte expression, not `${...}`, which would put a literal `$` in the URL.
    expect(editPage?.content).toContain(
      '<Button href="/contacts/{params.id}" variant="outline" size="sm">Cancel</Button>',
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

  it("gives a fixture's relation to users the authenticated test user", async () => {
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
          cms: false,
        },
        argv: ["task", "name:text", "workspace:workspace"],
      }),
    );

    const test = result.creates.find((file) =>
      file.path.endsWith("server.test.ts"),
    );
    // `users` is not created as a fixture in auth mode, so the workspace
    // fixture's required owner has to be the user the test logs in as.
    expect(test?.content).toMatch(
      /collection\("workspaces"\)\s*\.create\(\{[^}]*"?owner"?: context\.user\.id/,
    );
    expect(test?.content).not.toContain("missing-relation-id");
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
          cms: false,
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

    // Every page that links into the dynamic route declares `params`, and the
    // create action reads it for its redirect.
    for (const page of [listPage, newPage, showPage]) {
      expect(page?.content).toContain("let { data, params } = $props();");
    }
    expect(newServer?.content).toContain(
      "default: async ({ locals, request, params }) =>",
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
  it("builds the list page on TanStack Table v9", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: [
          "contact",
          "name:text!",
          "status:select(draft,published)",
          "tags:select(work,home)",
        ],
      }),
    );
    const listPage = result.creates.find((file) =>
      file.path.endsWith("/contacts/+page.svelte"),
    )?.content;

    expect(listPage).toContain(
      'import { createTable, FlexRender, renderComponent } from "$lib/components/ui/data-table";',
    );
    expect(listPage).toContain("const features = tableFeatures({");
    expect(listPage).toContain(
      'createColumnHelper<typeof features, Models["contacts"]>()',
    );
    expect(listPage).toContain(
      "filterFns: { includesString: filterFn_includesString, arrHas: filterFn_arrHas, arrIncludesSome: filterFn_arrIncludesSome },",
    );
    // The search box filters the text column; a facet sets an array of
    // values, so selects match one of them.
    expect(listPage).toMatch(
      /accessor\("name"[\s\S]*?filterFn: "includesString"/,
    );
    expect(listPage).toMatch(/accessor\("status"[\s\S]*?filterFn: "arrHas"/);
    expect(listPage).toMatch(
      /accessor\("tags"[\s\S]*?filterFn: "arrIncludesSome"/,
    );
    expect(listPage).toContain("<FlexRender {cell} />");
    expect(listPage).toContain("table.atoms.columnFilters.get()");
    for (const v8 of ["createSvelteTable", "getCoreRowModel", "getState()"]) {
      expect(listPage).not.toContain(v8);
    }
    expect(result.packages).toContain("@tanstack/table-core@^9.2.4");
  });

  it("filters on the first text field, and has no search box without one", async () => {
    const titled = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["post", "title:text", "body:text"],
      }),
    );
    const titledList = titled.creates.find((file) =>
      file.path.endsWith("/posts/+page.svelte"),
    )?.content;
    expect(titledList).toContain('table.getColumn("title")?.setFilterValue');
    expect(titledList).not.toContain('getColumn("name")');

    const numeric = await generateBase(
      makeOptions({ env: "preview", argv: ["reading", "value:number"] }),
    );
    const numericList = numeric.creates.find((file) =>
      file.path.endsWith("/readings/+page.svelte"),
    )?.content;
    expect(numericList).not.toContain("getColumn(");
    expect(numericList).not.toContain("$lib/components/ui/input");
    expect(numericList).not.toContain("filterFns:");
    expect(numericList).not.toContain("columnFacetingFeature");
  });

  it("generates native pages without shadcn-svelte", async () => {
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
          cms: false,
          ui: "plain",
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
    const page = (suffix: string) =>
      result.creates.find((file) => file.path.endsWith(suffix))?.content ?? "";

    expect(result.components).toEqual([]);
    expect(result.packages).toEqual([
      "sveltekit-superforms@^2.30.2",
      "zod@^4.1.11",
    ]);
    for (const suffix of [
      "/contacts/+page.svelte",
      "/contacts/new/+page.svelte",
      "/contacts/[id]/+page.svelte",
      "/contacts/[id]/edit/+page.svelte",
    ]) {
      expect(page(suffix)).not.toContain("$lib/components/ui");
      expect(page(suffix)).not.toContain("class=");
    }

    const list = page("/contacts/+page.svelte");
    expect(list).toContain("{#each data.contacts as contact (contact.id)}");
    expect(list).toContain(
      '<td>{contact.status ? statusLabels[contact.status].label : ""}</td>',
    );
    expect(list).toContain("<td>{contact.expand?.category?.name}</td>");
    expect(list).toContain(
      '<form method="POST" action="/contacts/{contact.id}">',
    );
    expect(list).not.toContain("tanstack");

    const newPage = page("/contacts/new/+page.svelte");
    expect(newPage).toContain(
      '<form method="POST" enctype="multipart/form-data" use:enhance>',
    );
    expect(newPage).toContain(
      '<input type="hidden" name="owner" value="current_user" />',
    );
    expect(newPage).toContain('<a href="/contacts">Cancel</a>');

    const editPage = page("/contacts/[id]/edit/+page.svelte");
    expect(editPage).toContain("let { data, params } = $props();");
    expect(editPage).toContain(
      '<input type="hidden" name="owner" bind:value={$formData.owner} />',
    );
    expect(editPage).toContain('<a href="/contacts/{params.id}">Cancel</a>');

    const showPage = page("/contacts/[id]/+page.svelte");
    expect(showPage).toContain("<dt>Name</dt>");
    expect(showPage).toContain("<dd>{data.contact.name}</dd>");
    expect(showPage).toContain(
      '<a href="/api/files/{data.contact.collectionId}/{data.contact.id}/{filename}">{filename}</a>',
    );
    expect(showPage).toContain(
      '<a href="/contacts/{data.contact.id}/edit">Edit</a>',
    );

    // The server side is the same as the shadcn scaffold's.
    expect(page("/contacts/new/+page.server.ts")).toContain(
      "owner: locals.pb.authStore.record?.id",
    );
  });

  it("interpolates dynamic params in plain links", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["project", "name:text!"],
        input: { route: "(app)/[team_id]/projects", ui: "plain" },
      }),
    );
    const list = result.creates.find((file) =>
      file.path.endsWith("/projects/+page.svelte"),
    )?.content;
    expect(list).toContain("let { data, params } = $props();");
    expect(list).toContain(
      "<a href={`/${params.team_id}/projects/${project.id}/edit`}>Edit</a>",
    );
  });

  it("leaves out server.test.ts without the test harness", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["note", "title:text"],
        input: { serverTests: false },
      }),
    );
    expect(
      result.creates.some((file) => file.path.endsWith("server.test.ts")),
    ).toBe(false);
  });
});
