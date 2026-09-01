import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatResult } from "./format-result";
import type { Result } from "./types";

const SOURCE = `import { z } from "zod";\nexport const schema = z.object({ name: z.string(), });\n`;

function resultWith(content: string): Result {
  return {
    creates: [
      {
        path: "src/lib/schemas/thing.ts",
        language: "ts",
        content,
        status: "success",
      },
    ],
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  };
}

describe("formatResult", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "format-result-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("uses the target project's prettier config at runtime", async () => {
    writeFileSync(
      path.join(root, ".prettierrc"),
      JSON.stringify({
        useTabs: true,
        singleQuote: true,
        trailingComma: "none",
        plugins: ["prettier-plugin-svelte"],
      }),
    );

    const { creates } = await formatResult(resultWith(SOURCE), {
      env: "runtime",
      root,
    });

    expect(creates[0].content).toBe(
      `import { z } from 'zod';\nexport const schema = z.object({ name: z.string() });\n`,
    );
  });

  it("falls back to prettier defaults without a project config", async () => {
    const { creates } = await formatResult(resultWith(SOURCE), {
      env: "runtime",
      root,
    });

    expect(creates[0].content).toBe(
      `import { z } from "zod";\nexport const schema = z.object({ name: z.string() });\n`,
    );
  });

  it("ignores project config in preview mode", async () => {
    writeFileSync(
      path.join(root, ".prettierrc"),
      JSON.stringify({ singleQuote: true }),
    );

    const { creates } = await formatResult(resultWith(SOURCE), {
      env: "preview",
      root,
    });

    expect(creates[0].content).toContain(`from "zod"`);
  });
});
