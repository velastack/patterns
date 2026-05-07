import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";
import formPattern from "./index";

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
        id: "contacts_preview",
        name: "contacts",
        type: "base",
        fields: [
          { name: "name", type: "text", required: true },
          { name: "email", type: "email" },
          { name: "bio", type: "editor" },
        ],
      },
      {
        id: "posts_preview",
        name: "posts",
        type: "base",
        fields: [
          { name: "title", type: "text", required: true },
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

vi.mock("../../../runtime/write-result", () => {
  return {
    writeResult: async (result: unknown) => result,
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

describe("generate form pattern", () => {
  it("errors when no fields are provided and there is no backend to derive from", async () => {
    await expect(
      generateBase(
        makeOptions({
          env: "preview",
          features: {
            auth: false,
            api: false,
            apiKeys: false,
            backend: false,
            i18n: false,
            teams: false,
            payments: false,
            blog: false,
            contentNegotiation: false,
          },
          argv: ["contact"],
        }),
      ),
    ).rejects.toThrow(
      /Cannot derive fields from a collection without a backend/,
    );
  });

  it("derives fields from an existing collection and creates a record on submit", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["contact"],
      }),
    );

    const schema = result.creates.find((file) =>
      file.path.endsWith("src/lib/schemas/contact.ts"),
    );
    // Fields come from the mocked contacts collection (name, email, bio).
    expect(schema?.content).toContain("name: z.string().nonempty()");
    expect(schema?.content).toContain("email: z.email().optional()");
    expect(schema?.content).toContain("bio: z.string().optional()");

    const page = result.creates.find((file) =>
      file.path.endsWith("+page.svelte"),
    );
    expect(page?.content).toContain('name="name"');
    expect(page?.content).toContain('name="email"');
    expect(page?.content).toContain('name="bio"');

    // Server action creates a record (no redirect — flash + return form).
    const server = result.creates.find((file) =>
      file.path.endsWith("+page.server.ts"),
    );
    expect(server?.content).toContain("import { setPocketbaseErrors }");
    expect(server?.content).toContain(
      'await locals.admin.collection("contacts").create',
    );
    expect(server?.content).toContain("setFlash");
    expect(server?.content).toContain("Contact created");
    expect(server?.content).not.toContain("redirect(303");
  });

  it("injects current_user when deriving from a collection with an auth-bound relation", async () => {
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
        argv: ["post"],
      }),
    );

    const server = result.creates.find((file) =>
      file.path.endsWith("+page.server.ts"),
    );
    // Sentinel value seeded into the form on load, replaced server-side on submit.
    expect(server?.content).toContain('owner: "current_user"');
    expect(server?.content).toContain("owner: locals.pb.authStore.record?.id");

    const page = result.creates.find((file) =>
      file.path.endsWith("+page.svelte"),
    );
    // current_user field is hidden, not rendered as a relation picker.
    expect(page?.content).toContain(
      '<input type="hidden" name="owner" bind:value={$formData.owner} />',
    );
  });

  it("generates page, server and schema files from parsed fields", async () => {
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
          'status:select(draft:"Draft",published:"Published")',
          "attachments:files",
          "owner:current_user",
        ],
      }),
    );

    expect(result.creates.map((file) => file.path)).toEqual([
      "src/routes/(app)/contact/+page.svelte",
      "src/routes/(app)/contact/+page.server.ts",
      "src/routes/(app)/contact/server.test.ts",
      "src/lib/schemas/contact.ts",
    ]);

    const page = result.creates.find((file) =>
      file.path.endsWith("+page.svelte"),
    );
    const server = result.creates.find((file) =>
      file.path.endsWith("+page.server.ts"),
    );
    const schema = result.creates.find((file) =>
      file.path.endsWith("src/lib/schemas/contact.ts"),
    );
    const serverTest = result.creates.find((file) =>
      file.path.endsWith("/contact/server.test.ts"),
    );

    expect(page?.content).toContain("const statusLabels =");
    expect(page?.content).toContain(
      '<FileForm.Field {form} name="attachments"',
    );
    expect(page?.content).toContain('name="owner"');
    expect(page?.content).toContain('enctype="multipart/form-data"');
    expect(page?.content).toContain('placeholder="Select an option"');
    expect(page?.content).toContain('placeholder="Search users..."');

    expect(server?.content).toContain("withFiles");
    expect(server?.content).toContain("setFlash");
    expect(serverTest?.content).toContain('describe("GET /contact"');
    expect(serverTest?.content).toContain('describe("POST /contact"');

    expect(schema?.content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );
    expect(schema?.content).toContain(
      "'attachments-': z.string().array().optional()",
    );

    expect(result.components).toEqual([
      "form",
      "input",
      "multiselect",
      "file-form",
      "button",
    ]);
  });

  it("generates a form without a backend when given simple field types", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        features: {
          auth: false,
          api: false,
          apiKeys: false,
          backend: false,
          i18n: false,
          teams: false,
          payments: false,
          blog: false,
          contentNegotiation: false,
        },
        argv: ["note", "title:text!", "body:editor"],
      }),
    );

    expect(result.creates.map((file) => file.path)).toEqual([
      "src/routes/(public)/note/+page.svelte",
      "src/routes/(public)/note/+page.server.ts",
      "src/routes/(public)/note/server.test.ts",
      "src/lib/schemas/note.ts",
    ]);

    const schema = result.creates.find((file) =>
      file.path.endsWith("src/lib/schemas/note.ts"),
    );
    expect(schema?.content).not.toContain("@velastack/pocketbase");
    expect(schema?.content).toContain("title: z.string().nonempty()");
  });

  it("throws when a relation field is requested without a backend", async () => {
    await expect(
      generateBase(
        makeOptions({
          env: "preview",
          features: {
            auth: false,
            api: false,
            apiKeys: false,
            backend: false,
            i18n: false,
            teams: false,
            payments: false,
            blog: false,
            contentNegotiation: false,
          },
          argv: ["note", "title:text!", "owner:users"],
        }),
      ),
    ).rejects.toThrow();
  });

  it("emits files at a custom --route with dynamic params", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        features: {
          auth: true,
          api: false,
          apiKeys: false,
          backend: false,
          i18n: false,
          teams: false,
          payments: false,
          blog: false,
          contentNegotiation: false,
        },
        argv: ["project", "name:text!"],
        input: { route: "(app)/[team_id]/projects/new" },
      }),
    );

    expect(result.creates.map((file) => file.path)).toEqual([
      "src/routes/(app)/[team_id]/projects/new/+page.svelte",
      "src/routes/(app)/[team_id]/projects/new/+page.server.ts",
      "src/routes/(app)/[team_id]/projects/new/server.test.ts",
      "src/lib/schemas/project.ts",
    ]);

    const test = result.creates.find((file) =>
      file.path.endsWith("/projects/new/server.test.ts"),
    );
    expect(test?.content).toContain(
      "// TODO: customize test fixture values for dynamic route params: team_id",
    );
    expect(test?.content).toContain('describe("/test_team_id/projects/new"');
    expect(test?.content).toContain('agent.get("/test_team_id/projects/new")');
  });

  it("returns the same create output in preview and runtime", async () => {
    const argv = ["note", "title:text", "body:editor"];

    const previewResult = await formPattern.generate(
      makeOptions({
        env: "preview",
        argv,
      }),
    );

    const runtimeResult = await formPattern.generate(
      makeOptions({
        env: "runtime",
        argv,
      }),
    );

    expect(runtimeResult.creates).toEqual(previewResult.creates);
    expect(runtimeResult.components).toEqual(previewResult.components);
    expect(runtimeResult.packages).toEqual(previewResult.packages);
  });
});
