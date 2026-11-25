import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import pattern from "./index";

const order: string[] = [];

vi.mock("../../../runtime/pocketbase", () => ({
  withPocketbase: async (_root: string, run: (pb: unknown) => Promise<void>) =>
    run({}),
}));
vi.mock("../../../runtime/collections", () => ({
  applyCollectionFieldsPatches: async () => {
    order.push("collection");
    return [];
  },
}));
vi.mock("../../../runtime/write-result", () => ({
  writeResult: async (result: unknown) => result,
}));

let root: string | undefined;

afterEach(() => {
  if (root) fs.rmSync(root, { recursive: true, force: true });
  order.length = 0;
});

describe("generate migration at runtime", () => {
  it("patches the collection's zod schema once the collection has changed", async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "migration-index-"));
    const schemaPath = path.join(root, "src", "lib", "schemas", "song.ts");
    fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
    fs.writeFileSync(
      schemaPath,
      `import { z } from "zod";\n\nexport const songSchema = z.object({\n  title: z.string().nonempty(),\n});\n`,
    );

    const result = await pattern.generate({
      argv: ["songs", "add", "year:number"],
      env: "runtime",
      root,
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
      getCollections: (async () => [
        {
          id: "songs_id",
          name: "songs",
          type: "base",
          fields: [{ name: "title", type: "text", required: true }],
        },
      ]) as never,
    });

    expect(order).toEqual(["collection"]);
    expect(result.modifies).toHaveLength(1);
    expect(result.modifies[0]).toMatchObject({
      path: schemaPath,
      status: "success",
    });
    expect(result.modifies[0].content).toContain("year: z.number().optional()");
    expect(fs.readFileSync(schemaPath, "utf8")).toContain(
      "year: z.number().optional()",
    );
  });
});
