import { describe, expect, it, vi } from "vitest";
import { compile } from "svelte/compiler";
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

  describe("edit form", () => {
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
    const generateNote = async (...fields: string[]) => {
      const result = await generateBase(
        makeOptions({
          env: "preview",
          features: withAuth,
          argv: ["note", ...fields],
        }),
      );
      const file = (suffix: string) =>
        result.creates.find((entry) => entry.path.endsWith(suffix))!.content;
      return {
        editPage: file("/notes/[id]/edit/+page.svelte"),
        editRemote: file("/notes/[id]/edit/form.remote.ts"),
        newPage: file("/notes/new/+page.svelte"),
        newRemote: file("/notes/new/form.remote.ts"),
      };
    };

    it("starts every control from the saved record", async () => {
      const { editPage } = await generateNote(
        "title:text!",
        "count:number",
        "active:bool",
        "due:date",
        "site:url",
        "mail:email",
        "body:editor",
        "meta:json",
        "state:select(open,closed)",
        "tags:select(a,b,c)",
        "createdOn:autodate",
      );

      expect(editPage).toContain('import { untrack } from "svelte";');
      await expect(
        editPage.slice(
          editPage.indexOf("updateNoteForm.fields.set("),
          editPage.indexOf("</script>"),
        ),
      ).toMatchFormatted(
        `updateNoteForm.fields.set(
          untrack(() => ({
            title: data.note.title,
            count: data.note.count,
            active: data.note.active,
            due: data.note.due?.slice(0, 10),
            site: data.note.site,
            mail: data.note.mail,
            body: data.note.body,
            meta: data.note.meta == null ? "" : JSON.stringify(data.note.meta, null, 2),
            state: data.note.state,
            tags: data.note.tags,
            createdOn: data.note.createdOn,
          })),
        );`,
        "seed.ts",
      );
      // After the props it reads, and before any markup.
      expect(editPage.indexOf("$props()")).toBeLessThan(
        editPage.indexOf("updateNoteForm.fields.set("),
      );
    });

    it("reads the record without a Svelte warning", async () => {
      // A bare top-level `data.note.title` is `state_referenced_locally`,
      // which fails a project's `svelte-check`.
      const { editPage } = await generateNote("title:text!", "due:date");
      const { warnings } = compile(editPage, {
        filename: "+page.svelte",
        generate: false,
      });
      expect(warnings).toEqual([]);
    });

    it("leaves the create form empty", async () => {
      const { newPage } = await generateNote("title:text!", "active:bool");
      expect(newPage).not.toContain("fields.set(");
      expect(newPage).not.toContain("untrack");
    });

    it("seeds nothing for a field the form has no control for", async () => {
      const { editPage } = await generateNote(
        "title:text",
        "category:relation",
        "spot:geoPoint",
        "photos:files",
        "owner:current_user",
      );
      const seed = editPage.slice(
        editPage.indexOf("updateNoteForm.fields.set("),
        editPage.indexOf("</script>"),
      );
      expect(seed).toContain("title: data.note.title");
      for (const name of ["category", "spot", "photos", "owner"]) {
        expect(seed).not.toContain(`${name}:`);
      }
    });

    it("writes an unticked checkbox as false", async () => {
      const { editRemote } = await generateNote("title:text", "active:bool");
      expect(editRemote).toContain("active: rest.active ?? false,");
    });

    it("writes an empty json textarea as null, not as the string it posts", async () => {
      const { editRemote, newRemote } = await generateNote(
        "title:text",
        "meta:json",
      );
      expect(editRemote).toContain("meta: rest.meta || null,");
      expect(newRemote).not.toContain("|| null");
    });

    it("does not show, require or clear a file or a password", async () => {
      const { editPage, editRemote, newPage } = await generateNote(
        "title:text!",
        "cover:file!",
        "doc:file",
        "pin:password!",
      );

      // Neither can be put back into its input.
      expect(editPage).not.toMatch(/\b(cover|doc|pin): data\.note/);
      // Required on create, optional on edit: empty means "keep it".
      const control = (page: string, id: string) =>
        page.slice(
          page.indexOf(`id="${id}"`),
          page.indexOf("/>", page.indexOf(`id="${id}"`)),
        );
      expect(control(newPage, "cover")).toContain("required");
      expect(control(newPage, "pin")).toContain("required");
      expect(control(editPage, "cover")).not.toContain("required");
      expect(control(editPage, "pin")).not.toContain("required");
      expect(control(editPage, "title")).toContain("required");

      await expect(editRemote).toMatchFormatted(
        `import { form, getRequestEvent } from "$app/server";
        import { error, redirect } from "@sveltejs/kit";
        import { noteSchema } from "#lib/schemas/note.js";

        // A stored file stays unless a new one is chosen, so the edit form does
        // not ask for it again.
        const updateNoteSchema = noteSchema.extend({
          cover: noteSchema.shape.cover.optional(),
        });

        export const updateNoteForm = form(updateNoteSchema, async (data) => {
          const { locals } = getRequestEvent();
          const { id, collectionId, cover, doc, pin, ...rest } = data;
          if (!id) error(400, "id is required");
          await locals.pb.collection("notes").update(id, {
            ...rest,
            // Left empty, these keep what is stored: an empty value would delete it.
            ...(cover instanceof File ? { cover } : {}),
            ...(doc instanceof File ? { doc } : {}),
            ...(pin ? { pin } : {}),
          });
          redirect(303, \`/notes/\${id}\`);
        });`,
        "form.remote.ts",
      );
    });

    it("keeps the plain update when nothing needs guarding", async () => {
      const { editRemote } = await generateNote("title:text!", "count:number");
      expect(editRemote).toContain(
        'await locals.pb.collection("notes").update(id, rest);',
      );
      expect(editRemote).toContain("form(noteSchema, async (data) => {");
    });
  });
});
