import dedent from "dedent";
import { describe, expect, it } from "vitest";
import {
  detectIndent,
  ensureImports,
  formatLikeSource,
  ensureBlankLineAfterImports,
  ensureNamedImport,
  ensurePropsBinding,
  isEffectivelyEmpty,
  pruneUnusedImports,
  removeAttachedComments,
  removeNamedImportIfUnused,
  removePropsBindingIfUnused,
  removeUnusedBindingElement,
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

describe("ensurePropsBinding", () => {
  it("adds the name to a typed destructuring, keeping the type", () => {
    const { source } = withInMemoryScript(
      "let { children }: { children?: Snippet; data?: any } = $props();\n",
      (sf) => ensurePropsBinding(sf, "data"),
    );
    expect(source).toContain(
      "let { children, data }: { children?: Snippet; data?: any } = $props();",
    );
  });

  it("inserts ahead of a rest element and leaves an existing name alone", () => {
    const { source } = withInMemoryScript(
      "let { children, ...rest } = $props();\n",
      (sf) => {
        ensurePropsBinding(sf, "data");
        ensurePropsBinding(sf, "data");
      },
    );
    expect(source).toContain("let { children, data, ...rest } = $props();");
  });

  it("declares $props() when the component has none", () => {
    const { source } = withInMemoryScript("import x from 'x';\n", (sf) =>
      ensurePropsBinding(sf, "data"),
    );
    expect(source).toContain("let { data } = $props();");
  });
});

describe("removePropsBindingIfUnused", () => {
  const typed =
    "let { children, data }: { children?: Snippet; data?: any } = $props();\n";

  it("removes a binding nothing reads", () => {
    const { source } = withInMemoryScript(typed, (sf) =>
      removePropsBindingIfUnused(sf, "data", "{@render children?.()}"),
    );
    expect(source).toContain(
      "let { children }: { children?: Snippet; data?: any } = $props();",
    );
  });

  it("keeps a binding the markup reads", () => {
    const { source } = withInMemoryScript(typed, (sf) =>
      removePropsBindingIfUnused(sf, "data", "<p>{data.meta.appName}</p>"),
    );
    expect(source).toBe(typed);
  });

  it("is not fooled by data-* attributes or text", () => {
    const { source } = withInMemoryScript(typed, (sf) =>
      removePropsBindingIfUnused(
        sf,
        "data",
        `<section data-role="content">Your data</section>\n<style>[data-role] {}</style>`,
      ),
    );
    expect(source).toContain("let { children }:");
  });

  it("keeps a binding the script reads", () => {
    const script = typed + "const user = $derived(data.user);\n";
    const { source } = withInMemoryScript(script, (sf) =>
      removePropsBindingIfUnused(sf, "data", ""),
    );
    expect(source).toBe(script);
  });
});

describe("removeUnusedBindingElement", () => {
  it("drops an unused name from a parameter's destructuring", () => {
    const { source } = withInMemoryScript(
      dedent`
        export const load = loadFlash(async ({ locals, url }) => {
          return { canonical: url.href };
        });
      `,
      (sf) => removeUnusedBindingElement(sf, "locals"),
    );
    expect(source).toContain("async ({ url }) =>");
  });

  it("drops a parameter left empty", () => {
    const { source } = withInMemoryScript(
      dedent`
        export function load({ locals }) {
          return {};
        }
      `,
      (sf) => removeUnusedBindingElement(sf, "locals"),
    );
    expect(source).toContain("export function load() {");
  });

  it("keeps a name still in use", () => {
    const input = dedent`
      export const load = async ({ locals }) => {
        return { team: locals.team };
      };
    `;
    const { source } = withInMemoryScript(input, (sf) =>
      removeUnusedBindingElement(sf, "locals"),
    );
    expect(source).toBe(input);
  });
});

describe("indentation", () => {
  it("detects tabs, the narrowest space indent, and defaults to tabs", () => {
    expect(detectIndent("a({\n\tb: 1\n});\n")).toBe("\t");
    expect(detectIndent("a({\n    b: {\n        c: 1\n    }\n});\n")).toBe(
      "    ",
    );
    expect(detectIndent("/**\n * doc\n */\na({\n  b: 1\n});\n")).toBe("  ");
    expect(detectIndent("const a = 1;\n")).toBe("\t");
  });

  it("formats in the file's own indentation", () => {
    const tabs = "export default {\n\tplugins: [\n\t\tone()\n\t]\n};\n";
    expect(withInMemoryScript(tabs, (sf) => formatLikeSource(sf)).source).toBe(
      tabs,
    );

    const two = "export default {\n  plugins: [\n    one()\n  ]\n};\n";
    expect(withInMemoryScript(two, (sf) => formatLikeSource(sf)).source).toBe(
      two,
    );
  });

  it("adds a statement level with an indented <script> body", () => {
    const script = "\n\timport a from 'a';\n\n\tlet { children } = $props();\n";
    const { source } = withInMemoryScript(script, (sf) =>
      ensureImports(sf, [{ defaultImport: "b", moduleSpecifier: "b" }]),
    );
    expect(source).toBe(
      "\n\timport a from 'a';\n\timport b from 'b';\n\n\tlet { children } = $props();\n",
    );
  });
});
