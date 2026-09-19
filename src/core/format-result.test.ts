import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatResult } from "./format-result";
import type { Result } from "./types";

const SOURCE = `import { z } from "zod";\nexport const schema = z.object({ name: z.string(), });\n`;

function resultWith(content: string, modified = content): Result {
  return {
    creates: [
      {
        path: "src/lib/schemas/thing.ts",
        language: "ts",
        content,
        status: "success",
      },
    ],
    modifies: [
      {
        path: "src/lib/schemas/other.ts",
        language: "ts",
        content: modified,
        status: "success",
      },
    ],
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

  it("falls back to prettier defaults when the project depends on prettier without a config", async () => {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { prettier: "^3.0.0" } }),
    );

    const { creates } = await formatResult(resultWith(SOURCE), {
      env: "runtime",
      root,
    });

    expect(creates[0].content).toBe(
      `import { z } from "zod";\nexport const schema = z.object({ name: z.string() });\n`,
    );
  });

  it("formats only created files when the project does not use prettier", async () => {
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devDependencies: { svelte: "^5.0.0" } }),
    );
    const existing = `import { z } from 'zod';\n\texport const other = z.object({ name: z.string(), });\n`;

    const { creates, modifies } = await formatResult(
      resultWith(SOURCE, existing),
      { env: "runtime", root },
    );

    expect(creates[0].content).toBe(
      `import { z } from "zod";\nexport const schema = z.object({ name: z.string() });\n`,
    );
    expect(modifies[0].content).toBe(existing);
  });

  it("formats with a config file even when prettier is not a dependency", async () => {
    writeFileSync(path.join(root, "package.json"), JSON.stringify({}));
    writeFileSync(
      path.join(root, ".prettierrc"),
      JSON.stringify({ singleQuote: true }),
    );

    const { creates } = await formatResult(resultWith(SOURCE), {
      env: "runtime",
      root,
    });

    expect(creates[0].content).toBe(
      `import { z } from 'zod';\nexport const schema = z.object({ name: z.string() });\n`,
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
