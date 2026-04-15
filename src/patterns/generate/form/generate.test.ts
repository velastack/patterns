import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";
import formPattern from "./index";

vi.mock("../../../parse/env.runtime", () => {
  return {
    getCollections: async () => [],
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
      payments: false,
    },
    input: overrides.input ?? {},
  };
}

describe("generate form pattern", () => {
  it("throws when no fields are provided", async () => {
    await expect(
      generateBase(
        makeOptions({
          env: "preview",
          argv: ["contact"],
        }),
      ),
    ).rejects.toThrow(/At least one field definition is required/);
  });

  it("generates page, server and schema files from parsed fields", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        features: { auth: true, api: false, payments: false },
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
