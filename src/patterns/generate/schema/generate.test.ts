import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";

const mockCollections = [
  {
    id: "contacts",
    name: "contacts",
    type: "base",
    fields: [
      { name: "id", type: "text", system: true },
      { name: "name", type: "text", required: true },
      {
        name: "status",
        type: "select",
        values: ["draft", "published"],
        maxSelect: 1,
      },
      { name: "attachments", type: "file", maxSelect: 5, required: false },
    ],
  },
];

vi.mock("../../../parse/env.runtime", () => {
  return {
    getCollections: async () => mockCollections,
  };
});

vi.mock("../../../parse/env.preview", () => {
  return {
    getPreviewCollections: () => mockCollections,
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
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
    },
    input: overrides.input ?? {},
  };
}

describe("generate schema pattern", () => {
  it("generates a basic schema from field args", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["contact", "name:text!", "email:email", "attachments:files"],
      }),
    );

    expect(result.creates).toHaveLength(1);
    expect(result.creates[0].path).toBe("src/lib/schemas/contact.ts");
    expect(result.creates[0].content).toContain("export const contactSchema");
    expect(result.creates[0].content).toContain("name: z.string().nonempty()");
    expect(result.creates[0].content).toContain("email: z.email().optional()");
    expect(result.creates[0].content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );
    expect(result.creates[0].content).toContain(
      "'attachments-': z.string().array().optional()",
    );
    expect(result.creates[0].content).not.toContain("satisfies Schemas");
  });

  it("hydrates schema fields from runtime collection when no fields are passed", async () => {
    const result = await generateBase(
      makeOptions({
        env: "runtime",
        argv: ["contact"],
      }),
    );

    expect(result.creates[0].content).toContain(
      'import type { Schemas } from "@velastack/pocketbase"',
    );
    expect(result.creates[0].content).toContain(
      'satisfies Schemas["contacts"]',
    );
    expect(result.creates[0].content).toContain(
      'status: z.enum(["draft", "published"]).optional()',
    );
    expect(result.creates[0].content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );
  });

  it("hydrates schema fields from preview collections when no fields are passed", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["contact"],
      }),
    );

    expect(result.creates[0].content).toContain(
      'import type { Schemas } from "@velastack/pocketbase"',
    );
    expect(result.creates[0].content).toContain(
      'satisfies Schemas["contacts"]',
    );
    expect(result.creates[0].content).toContain(
      'status: z.enum(["draft", "published"]).optional()',
    );
  });
});
