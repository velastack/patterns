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
      '<input {...updateContactForm.fields.id.as("hidden", data.contact.id)} />',
    );
    expect(editPage?.content).toContain('href="/contacts/{params.id}"');
    expect(editPage?.content).not.toContain("${params.id}");

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

  it("declares params where a dynamic route segment is interpolated", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["project", "name:text!"],
        input: { route: "(app)/[team_id]/projects" },
      }),
    );
    const content = (suffix: string) =>
      result.creates.find((file) => file.path.endsWith(suffix))?.content;

    expect(content("/projects/+page.svelte")).toContain(
      "let { data, params } = $props();",
    );
    expect(content("/projects/[id]/+page.svelte")).toContain(
      "let { data, params } = $props();",
    );
    expect(content("/projects/new/+page.svelte")).toContain(
      "let { params } = $props();",
    );
    // The remote functions read `params` off the request event for their redirects.
    expect(content("/projects/new/form.remote.ts")).toContain(
      "const { locals, params } = getRequestEvent();",
    );
    expect(content("/projects/[id]/edit/form.remote.ts")).toContain(
      "const { locals, params } = getRequestEvent();",
    );
    expect(content("/projects/new/form.remote.ts")).toContain(
      "redirect(303, `/${params.team_id}/projects/${project.id}`);",
    );
  });
  it("adds created and updated to the collection and to nothing else", async () => {
    const result = await generateBase(
      makeOptions({ env: "preview", argv: ["note", "title:text!"] }),
    );

    expect(result.collections[0].fields.slice(-2)).toEqual([
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ]);
    for (const file of result.creates) {
      expect(file.content, file.path).not.toMatch(/\b(created|updated)\b/);
    }
  });

  it("leaves a live collection's created and updated out of every page", async () => {
    const result = await generateBase(
      makeOptions({
        env: "runtime",
        argv: ["note"],
        getCollections: (async () => [
          {
            id: "notes_id",
            name: "notes",
            type: "base",
            fields: [
              { name: "id", type: "text", system: true },
              { name: "title", type: "text", required: true },
              { name: "created", type: "autodate", onCreate: true },
              {
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true,
              },
            ],
          },
        ]) as never,
      }),
    );

    expect(result.collections).toEqual([]);
    for (const file of result.creates) {
      expect(file.content, file.path).not.toMatch(/\b(created|updated)\b/);
    }
  });

  describe("input.rules", () => {
    const withAuth = {
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
    };

    it("superuser: null rules, pages on the admin client, and notes saying so", async () => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          argv: ["note", "title:text!"],
          features: withAuth,
          input: { rules: "superuser" },
        }),
      );

      expect(result.collections[0]).toMatchObject({
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
      });
      const servers = result.creates.filter(
        (file) =>
          file.path.endsWith("+page.server.ts") ||
          file.path.endsWith("form.remote.ts"),
      );
      expect(servers.length).toBeGreaterThan(2);
      for (const file of servers) {
        expect(file.content, file.path).toContain(
          'locals.admin.collection("notes")',
        );
        expect(file.content, file.path).not.toContain("locals.pb.collection");
      }
      expect(result.notes).toEqual([
        expect.stringContaining("only the superuser client"),
        expect.stringContaining("everyone who can open them"),
      ]);
    });

    it("auth: signed-in rules and the user's own client", async () => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          argv: ["note", "title:text!", "user:current_user"],
          features: withAuth,
          input: { rules: "auth" },
        }),
      );

      expect(result.collections[0].listRule).toBe('@request.auth.id != ""');
      expect(result.collections[0].deleteRule).toBe('@request.auth.id != ""');
      expect(result.notes).toEqual([]);
      expect(
        result.creates.find((file) =>
          file.path.endsWith("notes/+page.server.ts"),
        )?.content,
      ).toContain("locals.pb.collection");
    });

    it("is refused when the collection already exists", async () => {
      await expect(
        generateBase(
          makeOptions({
            env: "runtime",
            argv: ["note"],
            features: withAuth,
            input: { rules: "superuser" },
            getCollections: (async () => [
              {
                id: "notes_id",
                name: "notes",
                type: "base",
                fields: [{ name: "title", type: "text" }],
              },
            ]) as never,
          }),
        ),
      ).rejects.toThrow(/"notes" is not being created/);
    });
  });
});
