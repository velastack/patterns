import { describe, expect, it, vi } from "vitest";
import { compile } from "svelte/compiler";
import { Project } from "ts-morph";
import type { Options, Result } from "../../core/types";
import { generate as form } from "./form/generate";
import { generate as formRemote } from "./form-remote/generate";
import { generate as resource } from "./resource/generate";
import { generate as scaffold } from "./scaffold/generate";
import { generate as scaffoldRemote } from "./scaffold-remote/generate";

vi.mock("../../parse/env.preview", () => ({
  getPreviewCollections: () => [
    {
      id: "users_id",
      name: "users",
      type: "auth",
      fields: [{ name: "email", type: "email" }],
    },
    {
      id: "categories_id",
      name: "blog_categories",
      type: "base",
      fields: [{ name: "name", type: "text" }],
    },
  ],
}));

/** One snake_case field of every type the syntax has. */
const argv = [
  "note",
  "first_name:text!:unique",
  "item_count:number",
  "is_active:bool",
  "birth_date:date",
  "work_email:email",
  "home_page:url",
  "secret_code:password",
  "long_bio:editor",
  "extra_data:json",
  "home_location:geoPoint",
  "shirt_size:select(s:Small,m:Medium)",
  "favorite_colors:select(red,blue)",
  "profile_photo:file",
  "gallery_images:files",
  "main_category:blog_category",
  "other_categories:blog_categories",
  "created_by:current_user",
  "created_at:autodate",
];

const generators: Array<
  [string, (options: Options) => Promise<Result>, Options["input"]]
> = [
  ["resource", resource, {}],
  ["scaffold", scaffold, {}],
  ["scaffold --ui plain", scaffold, { ui: "plain" }],
  ["scaffold --remote", scaffoldRemote, {}],
  ["form", form, {}],
  ["form --ui plain", form, { ui: "plain" }],
  ["form --remote", formRemote, {}],
];

function syntaxErrors(path: string, content: string): string[] {
  if (path.endsWith(".svelte")) {
    try {
      compile(content, { filename: path, generate: false });
      return [];
    } catch (error) {
      return [(error as Error).message];
    }
  }
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("/file.ts", content);
  return project
    .getProgram()
    .getSyntacticDiagnostics(sourceFile)
    .map((diagnostic) => String(diagnostic.getMessageText()));
}

describe("snake_case field names", () => {
  it.each(generators)(
    "%s generates code that parses",
    async (_, generate, input) => {
      const result = await generate({
        argv,
        env: "preview",
        root: "/tmp/project",
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
        input,
      });

      expect(result.creates.length).toBeGreaterThan(0);
      for (const file of result.creates) {
        expect(syntaxErrors(file.path, file.content), file.path).toEqual([]);
      }
    },
  );

  it("titles a field by its words and keeps the name as the key", async () => {
    const result = await scaffoldRemote({
      argv: ["note", "first_name:text!"],
      env: "preview",
      root: "/tmp/project",
      features: {
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
      input: {},
    });
    const file = (suffix: string) =>
      result.creates.find((entry) => entry.path.endsWith(suffix))!.content;

    expect(file("schemas/note.ts")).toContain(
      "first_name: z.string().nonempty()",
    );
    expect(file("new/+page.svelte")).toContain(
      '<label for="first_name" class="text-sm font-medium">First Name</label>',
    );
    expect(file("new/+page.svelte")).toContain(
      'createNoteForm.fields.first_name.as("text")',
    );
    expect(result.collections[0].fields[0]).toEqual({
      name: "first_name",
      type: "text",
      required: true,
    });
  });
});
