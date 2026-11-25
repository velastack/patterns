import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Options } from "../../../../core/types";
import { resolveMigration } from "../generate";
import { modifySchema, modifySchemaForMigration } from "./schema";

const collections = [
  {
    id: "songs_id",
    name: "songs",
    type: "base",
    fields: [
      { name: "id", type: "text", system: true },
      { name: "title", type: "text", required: true },
      { name: "artist", type: "text" },
      { name: "covers", type: "file", maxSelect: 5 },
    ],
  },
  { id: "users_id", name: "users", type: "auth", fields: [] },
];

vi.mock("../../../../parse/env.preview", () => ({
  getPreviewCollections: () => collections,
}));

/** What `generate resource songs title:text! artist:text covers:files` writes. */
const GENERATED = `import { z } from "zod";
import type { Schemas } from "@velastack/pocketbase";

export const songSchema = z.object({
  id: z.string().optional(),
  collectionId: z.string().optional(),
  title: z.string().nonempty(),
  artist: z.string().optional(),
  covers: z.string().array().optional(),
  "covers+": z.instanceof(File).array().optional(),
  "covers-": z.string().array().optional(),
}) satisfies Schemas["songs"];
`;

let root: string;
let schemaPath: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "migration-schema-"));
  schemaPath = path.join(root, "src", "lib", "schemas", "song.ts");
  fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const write = (content: string) => fs.writeFileSync(schemaPath, content);
const read = () => fs.readFileSync(schemaPath, "utf8");

function options(argv: string[]): Options {
  return {
    argv,
    env: "preview",
    root,
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
    input: {},
  };
}

async function migrate(...argv: string[]) {
  return modifySchemaForMigration(root, await resolveMigration(options(argv)));
}

describe("modifySchemaForMigration", () => {
  it("appends an added field to the zod object", async () => {
    write(GENERATED);
    const file = await migrate("songs", "add", "year:number", "label:text!");

    expect(file).toMatchObject({ path: schemaPath, status: "success" });
    // Formatted as the project would: `formatResult` runs prettier over it.
    await expect(read()).toMatchFormatted(
      GENERATED.replace(
        `  "covers-": z.string().array().optional(),\n`,
        `  "covers-": z.string().array().optional(),\n  year: z.number().optional(),\n  label: z.string().nonempty(),\n`,
      ),
      "song.ts",
    );
  });

  it("keeps everything else the user wrote", async () => {
    const edited = `import { z } from "zod";
import type { Schemas } from "@velastack/pocketbase";

// Titles are shown in a narrow column.
const MAX_TITLE = 80;

export const songSchema = z
  .object({
    id: z.string().optional(),
    title: z.string().nonempty().max(MAX_TITLE), // keep in sync with the list
    artist: z.string().trim().optional(),
  })
  .strict() satisfies Schemas["songs"];

export type Song = z.infer<typeof songSchema>;
`;
    write(edited);
    await migrate("songs", "add", "year:number");

    const result = read();
    expect(result).toContain("year: z.number().optional()");
    for (const line of edited.split("\n")) {
      expect(result).toContain(line.trim().replace(/,$/, ""));
    }
  });

  it("leaves a key that is already there as it is", async () => {
    write(
      GENERATED.replace(
        "artist: z.string().optional()",
        "year: z.number().int()",
      ),
    );
    const before = read();

    expect(await migrate("songs", "add", "year:number")).toBeNull();
    expect(read()).toBe(before);
  });

  it("adds all three keys of a multi-file field", async () => {
    write(GENERATED);
    await migrate("songs", "add", "sheets:files");

    expect(read()).toContain("sheets: z.string().array().optional()");
    expect(read()).toContain(
      "'sheets+': z.instanceof(File).array().optional()",
    );
    expect(read()).toContain("'sheets-': z.string().array().optional()");
  });

  it("adds the relation of a references op", async () => {
    write(GENERATED);
    await migrate("songs", "references", "user");

    expect(read()).toContain("user: z.string().optional()");
  });

  it("removes a field, with a multi-file field's extra keys", async () => {
    write(GENERATED);
    await migrate("songs", "remove", "artist", "covers");

    await expect(read()).toMatchFormatted(
      GENERATED.replace("  artist: z.string().optional(),\n", "")
        .replace("  covers: z.string().array().optional(),\n", "")
        .replace(`  "covers+": z.instanceof(File).array().optional(),\n`, "")
        .replace(`  "covers-": z.string().array().optional(),\n`, ""),
      "song.ts",
    );
  });

  it("renames a field and keeps its schema", async () => {
    write(
      GENERATED.replace(
        "artist: z.string().optional()",
        "artist: z.string().max(40)",
      ),
    );
    await migrate("songs", "rename", "artist", "performer");

    expect(read()).toContain("performer: z.string().max(40),");
    expect(read()).not.toContain("artist");
  });

  it("renames a multi-file field's extra keys with it", async () => {
    write(GENERATED);
    await migrate("songs", "rename", "covers", "sleeves");

    expect(read()).toContain("sleeves: z.string().array().optional()");
    expect(read()).toContain(
      "'sleeves+': z.instanceof(File).array().optional()",
    );
    expect(read()).toContain("'sleeves-': z.string().array().optional()");
    expect(read()).not.toContain("covers");
  });

  it("types an added json field as text when a remote form uses the schema", async () => {
    write(GENERATED);
    await migrate("songs", "add", "meta:json");
    expect(read()).toContain("meta: z.any().optional()");

    write(GENERATED);
    const route = path.join(root, "src", "routes", "(app)", "songs", "new");
    fs.mkdirSync(route, { recursive: true });
    fs.writeFileSync(
      path.join(route, "form.remote.ts"),
      `import { songSchema } from "#lib/schemas/song.js";\n`,
    );
    await migrate("songs", "add", "meta:json");
    expect(read()).toContain("meta: z.string().optional()");
  });

  it("reports nothing when the collection has no schema file", async () => {
    expect(await migrate("songs", "add", "year:number")).toBeNull();
    expect(fs.existsSync(schemaPath)).toBe(false);
  });

  it("leaves a file it does not recognise alone and says what to do by hand", async () => {
    const custom = `import * as v from "valibot";

export const songSchema = v.object({ title: v.string() });
`;
    write(custom);
    const file = await migrate("songs", "add", "year:number");

    expect(read()).toBe(custom);
    expect(file).toMatchObject({ path: schemaPath, status: "failed" });
    expect(file?.message).toContain("Update it by hand");
    expect(file?.message).toContain("add `year: z.number().optional()`");
  });

  it("does not guess between two schemas when neither has the generated name", () => {
    write(`import { z } from "zod";

export const createSong = z.object({ title: z.string() });
export const updateSong = z.object({ title: z.string().optional() });
`);
    const outcome = modifySchema(schemaPath, "songSchema", [
      { op: "rename", from: "title", to: "name" },
    ]);

    expect(outcome).toMatchObject({ status: "failed" });
    expect(outcome.status === "failed" && outcome.message).toContain(
      "rename `title` to `name`",
    );
  });

  it("prefers the schema under the generated name", () => {
    write(`import { z } from "zod";

export const filterSchema = z.object({ title: z.string() });
export const songSchema = z.object({ title: z.string() });
`);
    modifySchema(schemaPath, "songSchema", [
      { op: "remove", fieldName: "title" },
    ]);

    expect(read()).toContain(
      "export const filterSchema = z.object({ title: z.string() });",
    );
    expect(read()).toMatch(/export const songSchema = z\.object\(\{\s*\}\);/);
  });
});
