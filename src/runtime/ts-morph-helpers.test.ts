import dedent from "dedent";
import { describe, expect, it } from "vitest";
import {
  ensureBlankLineAfterImports,
  ensureNamedImport,
  isEffectivelyEmpty,
  pruneUnusedImports,
  removeAttachedComments,
  removeNamedImportIfUnused,
  removeStatementWithComments,
  removeTopLevelStatementByIdentifier,
  withInMemoryScript,
} from "./ts-morph-helpers";

describe("removeNamedImportIfUnused", () => {
  it("removes an unused import", () => {
    const { source, result } = withInMemoryScript(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = handleA;
      `,
      (sf) => removeNamedImportIfUnused(sf, "@sveltejs/kit/hooks", "sequence"),
    );
    expect(result.wasRemoved).toBe(true);
    expect(source).not.toContain("sequence");
  });

  it("keeps an aliased import while the alias is used", () => {
    const { source, result } = withInMemoryScript(
      dedent`
        import { sequence as seq } from '@sveltejs/kit/hooks';

        export const handle = seq(handleA, handleB);
      `,
      (sf) => removeNamedImportIfUnused(sf, "@sveltejs/kit/hooks", "sequence"),
    );
    expect(result.wasRemoved).toBe(false);
    expect(source).toContain("import { sequence as seq }");
  });

  it("removes an aliased import once the alias is unused", () => {
    const { result } = withInMemoryScript(
      dedent`
        import { sequence as seq } from '@sveltejs/kit/hooks';

        export const handle = handleA;
      `,
      (sf) => removeNamedImportIfUnused(sf, "@sveltejs/kit/hooks", "sequence"),
    );
    expect(result.wasRemoved).toBe(true);
  });

  it("keeps the rest of a shared declaration", () => {
    const { source } = withInMemoryScript(
      dedent`
        import { other, sequence } from '@sveltejs/kit/hooks';

        export const handle = other;
      `,
      (sf) => removeNamedImportIfUnused(sf, "@sveltejs/kit/hooks", "sequence"),
    );
    expect(source).toContain("import { other } from '@sveltejs/kit/hooks';");
  });
});

describe("pruneUnusedImports", () => {
  it("drops only the unused bindings of a shared declaration", () => {
    const { source, result } = withInMemoryScript(
      dedent`
        import { env } from '$env/dynamic/private';
        import { handlePocketbase, getPocketbase } from '@velastack/pocketbase';

        export const pb = getPocketbase();
      `,
      (sf) =>
        pruneUnusedImports(sf, [
          "$env/dynamic/private",
          "@velastack/pocketbase",
        ]),
    );
    expect(result.removed).toEqual(["env", "handlePocketbase"]);
    expect(source).toBe(dedent`
      import { getPocketbase } from '@velastack/pocketbase';

      export const pb = getPocketbase();
    `);
  });

  it("drops unused default and namespace imports", () => {
    const { source, result } = withInMemoryScript(
      dedent`
        import main from 'a';
        import * as js from 'b';

        export const x = 1;
      `,
      (sf) => pruneUnusedImports(sf, ["a", "b"]),
    );
    expect(result.removed).toEqual(["main", "js"]);
    expect(source.trim()).toBe("export const x = 1;");
  });

  it("keeps a type import used in an annotation", () => {
    const { result } = withInMemoryScript(
      dedent`
        import type { ServerInit } from '@sveltejs/kit';

        export const init: ServerInit = () => {};
      `,
      (sf) => pruneUnusedImports(sf, ["@sveltejs/kit"]),
    );
    expect(result.removed).toEqual([]);
  });

  it("checks an aliased binding by its local name", () => {
    const { result } = withInMemoryScript(
      dedent`
        import { handle as handleNegotiate } from '$lib/negotiate';

        export const handle = handleNegotiate;
      `,
      (sf) => pruneUnusedImports(sf, ["$lib/negotiate"]),
    );
    expect(result.removed).toEqual([]);
  });

  it("leaves side-effect imports and other modules alone", () => {
    const { source } = withInMemoryScript(
      dedent`
        import 'a';
        import { unused } from 'b';
      `,
      (sf) => pruneUnusedImports(sf, ["a"]),
    );
    expect(source).toContain("import 'a';");
    expect(source).toContain("import { unused } from 'b';");
  });
});

describe("ensureNamedImport", () => {
  it("adds a declaration for a new module", () => {
    const { source } = withInMemoryScript(`export const x = 1;\n`, (sf) =>
      ensureNamedImport(sf, "$env/dynamic/private", "env"),
    );
    expect(source).toContain("import { env } from '$env/dynamic/private';");
  });

  it("joins an existing import of the module once", () => {
    const { source } = withInMemoryScript(`import { a } from 'm';\n`, (sf) => {
      ensureNamedImport(sf, "m", "b");
      ensureNamedImport(sf, "m", "b");
    });
    expect(source).toBe(`import { a, b } from 'm';\n`);
  });

  it("joins a value import as an inline type specifier", () => {
    const { source } = withInMemoryScript(
      `import { error } from '@sveltejs/kit';\n`,
      (sf) => ensureNamedImport(sf, "@sveltejs/kit", "ServerInit", true),
    );
    expect(source).toBe(
      `import { error, type ServerInit } from '@sveltejs/kit';\n`,
    );
  });

  it("does not put a value name into an import type declaration", () => {
    const { source } = withInMemoryScript(
      `import type { Handle } from '@sveltejs/kit';\n`,
      (sf) => ensureNamedImport(sf, "@sveltejs/kit", "error"),
    );
    expect(source).toContain("import type { Handle } from '@sveltejs/kit';");
    expect(source).toContain("import { error } from '@sveltejs/kit';");
  });
});

describe("removeTopLevelStatementByIdentifier", () => {
  it("removes only the named declarator from a shared statement", () => {
    const { source } = withInMemoryScript(
      `export const handle = a, init = b;\n`,
      (sf) => removeTopLevelStatementByIdentifier(sf, "handle"),
    );
    expect(source).toBe(`export const init = b;\n`);
  });

  it("removes a function", () => {
    const { source, result } = withInMemoryScript(
      `function f() {}\nconst x = 1;\n`,
      (sf) => removeTopLevelStatementByIdentifier(sf, "f"),
    );
    expect(result.wasRemoved).toBe(true);
    expect(source).toBe(`const x = 1;\n`);
  });
});

describe("removeStatementWithComments", () => {
  const remove = (source: string, name: string) =>
    withInMemoryScript(source, (sf) =>
      removeStatementWithComments(sf, sf.getVariableStatementOrThrow(name)),
    ).source;

  it("takes the comment lines above, the JSDoc and a trailing comment", () => {
    expect(
      remove(
        dedent`
          import x from 'x';

          // one
          // two
          /** doc */
          export const init = () => startWorker(); // trailing
        ` + "\n",
        "init",
      ),
    ).toBe(`import x from 'x';\n`);
  });

  it("keeps a comment separated by a blank line", () => {
    expect(remove(`// header\n\nexport const init = 1;\n`, "init")).toBe(
      `// header\n`,
    );
  });

  it("keeps a blank line between the statements either side", () => {
    expect(
      remove(
        dedent`
          const a = 1;

          // Runs once
          export const init = () => startWorker();

          const b = 2;
        ` + "\n",
        "init",
      ),
    ).toBe(`const a = 1;\n\nconst b = 2;\n`);
  });

  it("does not add a blank line that was not there", () => {
    expect(
      remove(`const a = 1;\nconst init = 2;\nconst b = 3;\n`, "init"),
    ).toBe(`const a = 1;\nconst b = 3;\n`);
  });
});

describe("removeAttachedComments", () => {
  it("removes the JSDoc and comment lines, keeping the statement", () => {
    const { source } = withInMemoryScript(
      dedent`
        import x from 'x';

        // note
        /** doc */
        export const handle = x;
      ` + "\n",
      (sf) =>
        removeAttachedComments(sf, sf.getVariableStatementOrThrow("handle")),
    );
    expect(source).toBe(`import x from 'x';\n\nexport const handle = x;\n`);
  });
});

describe("ensureBlankLineAfterImports", () => {
  it("counts a JSDoc as part of the statement, not as spacing", () => {
    const { source } = withInMemoryScript(
      `import x from 'x';\n/**\n * doc\n */\nexport const y = x;\n`,
      (sf) => ensureBlankLineAfterImports(sf),
    );
    expect(source).toBe(
      `import x from 'x';\n\n/**\n * doc\n */\nexport const y = x;\n`,
    );
  });
});

describe("isEffectivelyEmpty", () => {
  const empty = (source: string) =>
    withInMemoryScript(source, isEffectivelyEmpty).result;

  it("is true for an empty file, whitespace, comments and stray semicolons", () => {
    expect(empty("")).toBe(true);
    expect(empty("\n\n")).toBe(true);
    expect(empty("// just a comment\n/* and another */\n")).toBe(true);
    expect(empty(";\n")).toBe(true);
  });

  it("is false once there is a statement", () => {
    expect(empty("import 'a';\n")).toBe(false);
    expect(empty("export {};\n")).toBe(false);
  });
});
