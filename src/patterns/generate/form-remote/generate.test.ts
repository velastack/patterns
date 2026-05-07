import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";
import formRemotePattern from "./index";

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

describe("generate form-remote pattern", () => {
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
    expect(schema?.content).toContain("name: z.string().nonempty()");
    expect(schema?.content).toContain("email: z.email().optional()");
    expect(schema?.content).toContain("bio: z.string().optional()");

    // Remote form action creates a record (no redirect — flash + return success).
    const remote = result.creates.find((file) =>
      file.path.endsWith("form.remote.ts"),
    );
    expect(remote?.content).toContain(
      'await locals.admin.collection("contacts").create',
    );
    expect(remote?.content).toContain("setFlash");
    expect(remote?.content).toContain("Contact created");
    expect(remote?.content).not.toContain("redirect(303");
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

    const remote = result.creates.find((file) =>
      file.path.endsWith("form.remote.ts"),
    );
    expect(remote?.content).toContain("owner: locals.pb.authStore.record?.id");

    const page = result.creates.find((file) =>
      file.path.endsWith("+page.svelte"),
    );
    // current_user field is hidden with sentinel value, not a relation picker.
    expect(page?.content).toContain(
      '<input type="hidden" name="owner" value="current_user" />',
    );
    // No TODO emitted for the injected relation.
    expect(page?.content).not.toContain(
      'relation field "owner" is not yet supported',
    );
  });

  it("generates page, remote and schema files from parsed fields", async () => {
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
        ],
      }),
    );

    expect(result.creates.map((file) => file.path)).toEqual([
      "src/routes/(app)/contact/+page.svelte",
      "src/routes/(app)/contact/form.remote.ts",
      "src/routes/(app)/contact/server.test.ts",
      "src/lib/schemas/contact.ts",
    ]);

    const page = result.creates.find((file) =>
      file.path.endsWith("+page.svelte"),
    );
    const remote = result.creates.find((file) =>
      file.path.endsWith("form.remote.ts"),
    );
    const schema = result.creates.find((file) =>
      file.path.endsWith("src/lib/schemas/contact.ts"),
    );
    const serverTest = result.creates.find((file) =>
      file.path.endsWith("/contact/server.test.ts"),
    );

    expect(page?.content).toContain(
      'import { submitContactForm } from "./form.remote";',
    );
    expect(page?.content).toContain("{...submitContactForm}");
    expect(page?.content).toContain('submitContactForm.fields.name.as("text")');
    expect(page?.content).toContain(
      'submitContactForm.fields.attachments.as("file")',
    );
    expect(page?.content).toContain(
      "{#each submitContactForm.fields.name.issues() as issue}",
    );
    expect(page?.content).toContain('enctype="multipart/form-data"');
    expect(page?.content).toContain('<option value="draft">Draft</option>');

    expect(remote?.content).toContain(
      'import { form, getRequestEvent } from "$app/server";',
    );
    expect(remote?.content).toContain(
      "export const submitContactForm = form(contactSchema,",
    );
    expect(remote?.content).toContain("setFlash");
    expect(remote?.content).toContain("return { success: true };");

    expect(serverTest?.content).toContain('describe("GET /contact"');
    expect(serverTest?.content).not.toContain('describe("POST /contact"');

    expect(schema?.content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );
    expect(schema?.content).toContain(
      "'attachments-': z.string().array().optional()",
    );

    expect(result.components).toEqual(["input", "button"]);
  });

  it("emits TODO placeholder for unsupported relation fields", async () => {
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
        argv: ["contact", "name:text!", "owner:current_user"],
      }),
    );

    const page = result.creates.find((file) =>
      file.path.endsWith("+page.svelte"),
    );
    expect(page?.content).toContain(
      '<!-- TODO: relation field "owner" is not yet supported by the remote form variant -->',
    );
  });

  it("generates a form-remote without a backend when given simple field types", async () => {
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
      "src/routes/(public)/note/form.remote.ts",
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

  it("returns the same create output in preview and runtime", async () => {
    const argv = ["note", "title:text", "body:editor"];

    const previewResult = await formRemotePattern.generate(
      makeOptions({
        env: "preview",
        argv,
      }),
    );

    const runtimeResult = await formRemotePattern.generate(
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
