import { describe, expect, it, vi } from "vitest";
import type { Options } from "../../../core/types";
import { generate as generateBase } from "./generate";

vi.mock("../../../parse/env.runtime", () => {
  return {
    getCollections: async () => [
      {
        id: "contacts",
        name: "contacts",
        type: "base",
        fields: [
          { name: "id", type: "text", system: true },
          { name: "name", type: "text", required: true },
          { name: "avatar", type: "file", maxSelect: 1, required: false },
          {
            name: "attachments",
            type: "file",
            maxSelect: 5,
            required: false,
          },
        ],
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
      i18n: false,
      teams: false,
      payments: false,
    },
    input: overrides.input ?? {},
  };
}

describe("generate resource pattern", () => {
  it("creates model schema from explicit field args", async () => {
    const result = await generateBase(
      makeOptions({
        env: "preview",
        argv: ["contact", "name:text!", "avatar:file", "attachments:files"],
      }),
    );

    expect(result.creates).toHaveLength(1);
    expect(result.creates[0].path).toBe("src/lib/schemas/contact.ts");
    expect(result.creates[0].content).toContain("id: z.string().optional()");
    expect(result.creates[0].content).toContain(
      "collectionId: z.string().optional()",
    );
    expect(result.creates[0].content).toContain(
      'avatar: z.union([z.instanceof(File), z.string()]).optional().default("")',
    );
    expect(result.creates[0].content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );
    expect(result.creates[0].content).toContain(
      "'attachments-': z.string().array().optional()",
    );
    expect(result.creates[0].content).toContain(
      'satisfies Schemas["contacts"]',
    );
    expect(result.collections).toEqual([
      {
        name: "contacts",
        type: "base",
        fields: [
          { name: "name", type: "text", required: true },
          { name: "avatar", type: "file", required: false, maxSelect: 1 },
          {
            name: "attachments",
            type: "file",
            required: false,
            maxSelect: 99,
          },
        ],
      },
    ]);
  });

  it("hydrates resource schema from runtime collection", async () => {
    const result = await generateBase(
      makeOptions({
        env: "runtime",
        argv: ["contact"],
      }),
    );

    expect(result.creates[0].content).toContain("name: z.string().nonempty()");
    expect(result.creates[0].content).toContain(
      'avatar: z.union([z.instanceof(File), z.string()]).optional().default("")',
    );
    expect(result.creates[0].content).toContain(
      "'attachments+': z.instanceof(File).array().optional()",
    );
    expect(result.creates[0].content).toContain(
      "'attachments-': z.string().array().optional()",
    );
    expect(result.collections).toEqual([]);
  });
});
