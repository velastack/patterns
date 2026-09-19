import dedent from "dedent";
import { Project, QuoteKind, type SourceFile } from "ts-morph";
import { describe, expect, it } from "vitest";
import {
  addHandle,
  listHandles,
  removeHandle,
  replaceHandle,
  type ComposeResult,
  type HandleSpec,
  type Unsupported,
} from "./compose-handle";

type Op = (sf: SourceFile) => ComposeResult;

const add =
  (expression: string, position?: HandleSpec["position"]): Op =>
  (sf) =>
    addHandle(sf, { expression, position });
const remove =
  (name: string): Op =>
  (sf) =>
    removeHandle(sf, name);
const replace =
  (name: string, spec: HandleSpec): Op =>
  (sf) =>
    replaceHandle(sf, name, spec);

/** Apply `ops` in order to `source`, as `hooks.server.ts` (or `.js`). */
function run(source: string, ops: Op[], fileName = "hooks.server.ts") {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sf = project.createSourceFile(fileName, source);
  const results = ops.map((op) => op(sf));
  return { text: sf.getFullText(), results, handles: listHandles(sf) };
}

function statuses(results: ComposeResult[]) {
  return results.map((r) => (r.status === "unsupported" ? r.reason : r.status));
}

const STATIC = dedent`
  import { handleStatic } from '@velastack/kit';

  /**
   * The footer links to pages that do not exist yet.
   */
  export const handle = handleStatic();
`;

const MINIMAL = dedent`
  import type { ServerInit } from '@sveltejs/kit';
  import { env } from '$env/dynamic/private';
  import { handlePocketbase } from '@velastack/pocketbase';
  import { startWorker } from '$lib/server/workflows';

  export const handle = handlePocketbase({
    pocketbaseUrl: env.POCKETBASE_URL,
    superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
    superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD
  });

  // Runs once when the server starts: executes the workflows in src/lib/workflows.
  export const init: ServerInit = () => startWorker();
`;

/**
 * Every shape `addHandle` composes. `added` is the file after adding
 * `handleNew` first; the round-trip properties below run over all of them.
 */
const SUPPORTED: { name: string; source: string; added: string }[] = [
  {
    name: "empty file",
    source: "",
    added: `export const handle = handleNew;`,
  },
  {
    name: "comments only",
    source: `// nothing here yet\n`,
    added: dedent`
      // nothing here yet

      export const handle = handleNew;
    `,
  },
  {
    name: "no handle, only an init",
    source: dedent`
      import type { ServerInit } from '@sveltejs/kit';

      export const init: ServerInit = () => {};
    `,
    added: dedent`
      import type { ServerInit } from '@sveltejs/kit';

      export const init: ServerInit = () => {};

      export const handle = handleNew;
    `,
  },
  {
    name: "no handle, the new handle only called inside a helper",
    source: dedent`
      import { handleNew } from 'x';

      export function helper() {
        return handleNew();
      }
    `,
    added: dedent`
      import { handleNew } from 'x';

      export function helper() {
        return handleNew();
      }

      export const handle = handleNew;
    `,
  },
  {
    name: "bare identifier",
    source: `export const handle = handleA;`,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, handleA);
    `,
  },
  {
    name: "call with JSDoc (static template)",
    source: STATIC,
    added: dedent`
      import { handleStatic } from '@velastack/kit';
      import { sequence } from '@sveltejs/kit/hooks';

      /**
       * The footer links to pages that do not exist yet.
       */
      export const handle = sequence(handleNew, handleStatic());
    `,
  },
  {
    name: "multi-line call with an init (minimal template)",
    source: MINIMAL,
    added: dedent`
      import type { ServerInit } from '@sveltejs/kit';
      import { env } from '$env/dynamic/private';
      import { handlePocketbase } from '@velastack/pocketbase';
      import { startWorker } from '$lib/server/workflows';
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(
        handleNew,
        handlePocketbase({
          pocketbaseUrl: env.POCKETBASE_URL,
          superuserEmail: env.POCKETBASE_SUPERUSER_EMAIL,
          superuserPassword: env.POCKETBASE_SUPERUSER_PASSWORD
        })
      );

      // Runs once when the server starts: executes the workflows in src/lib/workflows.
      export const init: ServerInit = () => startWorker();
    `,
  },
  {
    name: "sequence of two",
    source: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleA, handleB);
    `,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, handleA, handleB);
    `,
  },
  {
    name: "multi-line sequence of three with a trailing comma",
    source: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(
        handleA,
        handleB,
        handleC,
      );
    `,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, handleA, handleB, handleC);
    `,
  },
  {
    name: "nested sequence",
    source: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleA, sequence(handleB, handleC));
    `,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, handleA, sequence(handleB, handleC));
    `,
  },
  {
    name: "sequence imported under an alias",
    source: dedent`
      import { sequence as seq } from '@sveltejs/kit/hooks';

      export const handle = seq(handleA, handleB);
    `,
    added: dedent`
      import { sequence as seq } from '@sveltejs/kit/hooks';

      export const handle = seq(handleNew, handleA, handleB);
    `,
  },
  {
    name: "sequence through a namespace import",
    source: dedent`
      import * as hooks from '@sveltejs/kit/hooks';

      export const handle = handleA;
    `,
    added: dedent`
      import * as hooks from '@sveltejs/kit/hooks';

      export const handle = hooks.sequence(handleNew, handleA);
    `,
  },
  {
    name: "kit hooks already imported for something else",
    source: dedent`
      import { other } from '@sveltejs/kit/hooks';

      export const handle = other(handleA);
    `,
    added: dedent`
      import { other, sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, other(handleA));
    `,
  },
  {
    name: "type annotation",
    source: dedent`
      import type { Handle } from '@sveltejs/kit';

      export const handle: Handle = handleA;
    `,
    added: dedent`
      import type { Handle } from '@sveltejs/kit';
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle: Handle = sequence(handleNew, handleA);
    `,
  },
  {
    name: "satisfies",
    source: dedent`
      import type { Handle } from '@sveltejs/kit';

      export const handle = handleA satisfies Handle;
    `,
    added: dedent`
      import type { Handle } from '@sveltejs/kit';
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, handleA) satisfies Handle;
    `,
  },
  {
    name: "as",
    source: dedent`
      import type { Handle } from '@sveltejs/kit';

      export const handle = handleA as Handle;
    `,
    added: dedent`
      import type { Handle } from '@sveltejs/kit';
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, handleA) as Handle;
    `,
  },
  {
    name: "parenthesised sequence",
    source: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = (sequence(handleA, handleB));
    `,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = (sequence(handleNew, handleA, handleB));
    `,
  },
  {
    name: "function declaration with JSDoc",
    source: dedent`
      import type { Handle } from '@sveltejs/kit';

      /** Adds a header. */
      export async function handle({ event, resolve }) {
        const response = await resolve(event);
        response.headers.set('x-app', '1');
        return response;
      }
    `,
    added: dedent`
      import type { Handle } from '@sveltejs/kit';
      import { sequence } from '@sveltejs/kit/hooks';

      /** Adds a header. */
      async function handleApp({ event, resolve }) {
        const response = await resolve(event);
        response.headers.set('x-app', '1');
        return response;
      }

      export const handle = sequence(handleNew, handleApp);
    `,
  },
  {
    name: "arrow function with a type annotation",
    source: dedent`
      import type { Handle } from '@sveltejs/kit';

      export const handle: Handle = async ({ event, resolve }) => {
        return resolve(event);
      };
    `,
    added: dedent`
      import type { Handle } from '@sveltejs/kit';
      import { sequence } from '@sveltejs/kit/hooks';

      const handleApp: Handle = async ({ event, resolve }) => {
        return resolve(event);
      };

      export const handle = sequence(handleNew, handleApp);
    `,
  },
  {
    name: "function expression",
    source: dedent`
      export const handle = async function ({ event, resolve }) {
        return resolve(event);
      };
    `,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      const handleApp = async function ({ event, resolve }) {
        return resolve(event);
      };

      export const handle = sequence(handleNew, handleApp);
    `,
  },
  {
    name: "arrow wrapped in satisfies",
    source: dedent`
      import type { Handle } from '@sveltejs/kit';

      export const handle = (async ({ event, resolve }) => resolve(event)) satisfies Handle;
    `,
    added: dedent`
      import type { Handle } from '@sveltejs/kit';
      import { sequence } from '@sveltejs/kit/hooks';

      const handleApp = (async ({ event, resolve }) => resolve(event)) satisfies Handle;

      export const handle = sequence(handleNew, handleApp);
    `,
  },
  {
    name: "export let",
    source: `export let handle = handleA;`,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export let handle = sequence(handleNew, handleA);
    `,
  },
  {
    name: "one of several declarators",
    source: `export const handle = handleA, other = 1;`,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, handleA), other = 1;
    `,
  },
  {
    name: "declared, then exported by a specifier",
    source: dedent`
      const handle = handleA;

      export { handle };
    `,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      const handle = sequence(handleNew, handleA);

      export { handle };
    `,
  },
  {
    name: "function exported by a specifier",
    source: dedent`
      async function handle({ event, resolve }) {
        return resolve(event);
      }

      export { handle };
    `,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      async function handleApp({ event, resolve }) {
        return resolve(event);
      }

      const handle = sequence(handleNew, handleApp);

      export { handle };
    `,
  },
  {
    name: "conditional handle",
    source: `export const handle = dev ? handleA : handleB;`,
    added: dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleNew, dev ? handleA : handleB);
    `,
  },
];

describe("addHandle", () => {
  for (const { name, source, added } of SUPPORTED) {
    it(`adds to: ${name}`, async () => {
      const { text, results } = run(source, [add("handleNew")]);
      expect(statuses(results)).toEqual(["changed"]);
      await expect(text).toMatchFormatted(added, "hooks.server.ts");
    });
  }

  it("adds last", async () => {
    const { text, handles } = run(STATIC, [add("handleNew", "last")]);
    expect(handles).toEqual(["handleStatic", "handleNew"]);
    await expect(text).toMatchFormatted(
      dedent`
        import { handleStatic } from '@velastack/kit';
        import { sequence } from '@sveltejs/kit/hooks';

        /**
         * The footer links to pages that do not exist yet.
         */
        export const handle = sequence(handleStatic(), handleNew);
      `,
      "hooks.server.ts",
    );
  });

  it("adds last after an extracted function", () => {
    const { handles } = run(
      `export function handle({ event, resolve }) { return resolve(event); }`,
      [add("handleNew", "last")],
    );
    expect(handles).toEqual(["handleApp", "handleNew"]);
  });

  it("adds a call expression, matched by its callee", () => {
    const pocketbase =
      "handlePocketbase({ pocketbaseUrl: env.POCKETBASE_URL })";
    const spec = { expression: pocketbase, name: "handlePocketbase" };
    const { handles, results } = run(STATIC, [
      (sf) => addHandle(sf, spec),
      (sf) => addHandle(sf, spec),
    ]);
    expect(statuses(results)).toEqual(["changed", "unchanged"]);
    expect(handles).toEqual(["handlePocketbase", "handleStatic"]);
  });

  it("finds a handle already present in a nested sequence", () => {
    const source = dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleA, sequence(handleB, handleC));
    `;
    const { text, results } = run(source, [add("handleC")]);
    expect(statuses(results)).toEqual(["unchanged"]);
    expect(text).toBe(source);
  });

  it("finds a handle already present as the whole handle", () => {
    const { results } = run(`export const handle = handleA;`, [add("handleA")]);
    expect(statuses(results)).toEqual(["unchanged"]);
  });

  it("returns the handle statement to insert before", () => {
    const { results } = run(STATIC, [add("handleNew")]);
    const [result] = results;
    expect(result.status === "changed" && result.statement?.getText()).toBe(
      "export const handle = sequence(handleNew, handleStatic());",
    );
  });

  it("returns the handle statement when unchanged, too", () => {
    const { results } = run(`export const handle = handleA;`, [add("handleA")]);
    const [result] = results;
    expect(result.status === "unchanged" && result.statement?.getText()).toBe(
      "export const handle = handleA;",
    );
  });

  it("keeps the JSDoc of a function handle in a .js file", async () => {
    const source = dedent`
      /** @type {import('@sveltejs/kit').Handle} */
      export async function handle({ event, resolve }) {
        return resolve(event);
      }
    `;
    const { text } = run(source, [add("handleNew")], "hooks.server.js");
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        /** @type {import('@sveltejs/kit').Handle} */
        async function handleApp({ event, resolve }) {
          return resolve(event);
        }

        export const handle = sequence(handleNew, handleApp);
      `,
      "hooks.server.js",
    );
  });
});

describe("removeHandle", () => {
  it("removes the whole handle when it is the one handle", async () => {
    const { text, results, handles } = run(
      dedent`
        import { handleA } from 'a';

        // The only handle.
        export const handle = handleA;
      `,
      [remove("handleA")],
    );
    expect(statuses(results)).toEqual(["changed"]);
    expect(handles).toBeNull();
    // The import is the caller's to prune.
    await expect(text).toMatchFormatted(
      `import { handleA } from 'a';\n`,
      "hooks.server.ts",
    );
  });

  it("removes a call handle by its callee, with its JSDoc", async () => {
    const { text } = run(STATIC, [remove("handleStatic")]);
    await expect(text).toMatchFormatted(
      `import { handleStatic } from '@velastack/kit';\n`,
      "hooks.server.ts",
    );
  });

  it("takes the handle out of the minimal template and keeps the init", async () => {
    const { text } = run(MINIMAL, [remove("handlePocketbase")]);
    await expect(text).toMatchFormatted(
      dedent`
        import type { ServerInit } from '@sveltejs/kit';
        import { env } from '$env/dynamic/private';
        import { handlePocketbase } from '@velastack/pocketbase';
        import { startWorker } from '$lib/server/workflows';

        // Runs once when the server starts: executes the workflows in src/lib/workflows.
        export const init: ServerInit = () => startWorker();
      `,
      "hooks.server.ts",
    );
  });

  it("drops one argument from a longer sequence", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleA, handleB, handleC);
      `,
      [remove("handleB")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleA, handleC);
      `,
      "hooks.server.ts",
    );
  });

  it("unwraps a sequence of two and prunes the sequence import", async () => {
    const { text } = run(
      dedent`
        import { env } from '$env/dynamic/private';
        import { sequence } from '@sveltejs/kit/hooks';
        import { handlePocketbase } from '@velastack/pocketbase';

        export const handle = sequence(
          handleNegotiate,
          handlePocketbase({ pocketbaseUrl: env.POCKETBASE_URL }),
        );
      `,
      [remove("handleNegotiate")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { env } from '$env/dynamic/private';
        import { handlePocketbase } from '@velastack/pocketbase';

        export const handle = handlePocketbase({ pocketbaseUrl: env.POCKETBASE_URL });
      `,
      "hooks.server.ts",
    );
  });

  it("keeps the sequence import while something else uses it", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        const inner = sequence(handleB, handleC);

        export const handle = sequence(handleA, inner);
      `,
      [remove("handleA")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        const inner = sequence(handleB, handleC);

        export const handle = inner;
      `,
      "hooks.server.ts",
    );
  });

  it("keeps an aliased sequence import while the alias is used", async () => {
    const { text } = run(
      dedent`
        import { sequence as seq } from '@sveltejs/kit/hooks';

        export const handle = seq(handleA, handleB, handleC);
      `,
      [remove("handleA")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence as seq } from '@sveltejs/kit/hooks';

        export const handle = seq(handleB, handleC);
      `,
      "hooks.server.ts",
    );
  });

  it("prunes an aliased sequence import once unused", async () => {
    const { text } = run(
      dedent`
        import { sequence as seq } from '@sveltejs/kit/hooks';

        export const handle = seq(handleA, handleB);
      `,
      [remove("handleA")],
    );
    await expect(text).toMatchFormatted(
      `export const handle = handleB;\n`,
      "hooks.server.ts",
    );
  });

  it("collapses a nested sequence left with one handle", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleA, sequence(handleB, handleC));
      `,
      [remove("handleB")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleA, handleC);
      `,
      "hooks.server.ts",
    );
  });

  it("drops a nested sequence emptied by the removal", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleA, sequence(handleB));
      `,
      [remove("handleB")],
    );
    await expect(text).toMatchFormatted(
      `export const handle = handleA;\n`,
      "hooks.server.ts",
    );
  });

  it("unwraps a sequence of one that started out that way", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleA);
      `,
      [add("handleNew"), remove("handleNew")],
    );
    // sequence(handleA) -> sequence(handleNew, handleA) -> handleA: the
    // one-argument sequence is not remembered.
    await expect(text).toMatchFormatted(
      `export const handle = handleA;\n`,
      "hooks.server.ts",
    );
  });

  it("removes the last handle of a sequence of one", async () => {
    const { text, handles } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleA);
      `,
      [remove("handleA")],
    );
    expect(handles).toBeNull();
    expect(text.trim()).toBe("");
  });

  it("drops only the handle declarator from a shared statement", async () => {
    const { text } = run(`export const handle = handleA, other = 1;`, [
      remove("handleA"),
    ]);
    await expect(text).toMatchFormatted(
      `export const other = 1;\n`,
      "hooks.server.ts",
    );
  });

  it("drops the export specifier with the handle", async () => {
    const { text } = run(
      dedent`
        const handle = handleA;
        const other = 1;

        export { handle, other };
      `,
      [remove("handleA")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        const other = 1;

        export { other };
      `,
      "hooks.server.ts",
    );
  });

  it("drops an export declaration left empty", async () => {
    const { text } = run(
      dedent`
        const handle = handleA;

        export { handle };
      `,
      [remove("handleA")],
    );
    expect(text.trim()).toBe("");
  });

  it("is unchanged when the handle is absent", () => {
    const source = dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      export const handle = sequence(handleA, handleB);
    `;
    const { text, results } = run(source, [remove("handleNew")]);
    expect(statuses(results)).toEqual(["unchanged"]);
    expect(text).toBe(source);
  });

  it("is unchanged when there is no handle", () => {
    const { results } = run(`export const init = () => {};`, [
      remove("handleA"),
    ]);
    expect(statuses(results)).toEqual(["unchanged"]);
  });

  it("is unchanged for a function handle that does not use it", () => {
    const { results } = run(
      `export function handle({ event, resolve }) { return resolve(event); }`,
      [remove("handleA")],
    );
    expect(statuses(results)).toEqual(["unchanged"]);
  });

  it("does not restore a handleApp that is used elsewhere too", async () => {
    const source = dedent`
      import { sequence } from '@sveltejs/kit/hooks';

      const handleApp = async ({ event, resolve }) => resolve(event);

      export const other = handleApp;
      export const handle = sequence(handleNew, handleApp);
    `;
    const { text } = run(source, [remove("handleNew")]);
    await expect(text).toMatchFormatted(
      dedent`
        const handleApp = async ({ event, resolve }) => resolve(event);

        export const other = handleApp;
        export const handle = handleApp;
      `,
      "hooks.server.ts",
    );
  });

  it("inlines a handleApp the user wrote, like one it extracted", async () => {
    // Indistinguishable from an extracted one; pinned so a change is deliberate.
    const source = dedent`
      const handleApp = async ({ event, resolve }) => resolve(event);

      export const handle = handleApp;
    `;
    const { text } = run(source, [add("handleNew"), remove("handleNew")]);
    await expect(text).toMatchFormatted(
      `export const handle = async ({ event, resolve }) => resolve(event);\n`,
      "hooks.server.ts",
    );
  });

  it("keeps a restored function's JSDoc in a .js file", async () => {
    const source = dedent`
      /** @type {import('@sveltejs/kit').Handle} */
      export async function handle({ event, resolve }) {
        return resolve(event);
      }
    `;
    const { text } = run(
      source,
      [add("handleNew"), remove("handleNew")],
      "hooks.server.js",
    );
    await expect(text).toMatchFormatted(source, "hooks.server.js");
  });
});

describe("replaceHandle", () => {
  const pocketbase = {
    expression: "handlePocketbase({ pocketbaseUrl: env.POCKETBASE_URL })",
    name: "handlePocketbase",
    position: "last" as const,
  };

  it("swaps the whole handle and drops the JSDoc that described it", async () => {
    const { text, results } = run(STATIC, [
      replace("handleStatic", pocketbase),
    ]);
    expect(statuses(results)).toEqual(["changed"]);
    await expect(text).toMatchFormatted(
      dedent`
        import { handleStatic } from '@velastack/kit';

        export const handle = handlePocketbase({ pocketbaseUrl: env.POCKETBASE_URL });
      `,
      "hooks.server.ts",
    );
  });

  it("swaps a handle in its own slot of a sequence", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          handleWuchale,
          handleStatic(), // dev-only 404 hints
          handleNegotiate,
        );
      `,
      [replace("handleStatic", pocketbase)],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          handleWuchale,
          handlePocketbase({ pocketbaseUrl: env.POCKETBASE_URL }), // dev-only 404 hints
          handleNegotiate,
        );
      `,
      "hooks.server.ts",
    );
  });

  it("adds in the given position when the old handle is absent", () => {
    const { handles } = run(`export const handle = handleWuchale;`, [
      replace("handleStatic", pocketbase),
    ]);
    expect(handles).toEqual(["handleWuchale", "handlePocketbase"]);
  });

  it("adds the handle when there is none", () => {
    const { handles } = run("", [replace("handleStatic", pocketbase)]);
    expect(handles).toEqual(["handlePocketbase"]);
  });

  it("is unchanged when the new handle is already there", () => {
    const source = `export const handle = handlePocketbase({});`;
    const { text, results } = run(source, [
      replace("handleStatic", pocketbase),
    ]);
    expect(statuses(results)).toEqual(["unchanged"]);
    expect(text).toBe(source);
  });

  it("drops the old handle when both are there", () => {
    const { handles } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleStatic(), handlePocketbase({}));
      `,
      [replace("handleStatic", pocketbase)],
    );
    expect(handles).toEqual(["handlePocketbase"]);
  });

  it("composes with a function handle rather than replacing it", () => {
    const { handles } = run(
      `export function handle({ event, resolve }) { return resolve(event); }`,
      [replace("handleStatic", pocketbase)],
    );
    expect(handles).toEqual(["handleApp", "handlePocketbase"]);
  });
});

describe("unsupported shapes leave the file untouched", () => {
  const cases: { name: string; source: string; op: Op; reason: Unsupported }[] =
    [
      {
        name: "re-export from a module",
        source: `export { handle } from '$lib/negotiate';`,
        op: add("handleNew"),
        reason: "re-export",
      },
      {
        name: "re-export under another name",
        source: `export { mine as handle } from './mine';`,
        op: add("handleNew"),
        reason: "re-export",
      },
      {
        name: "local export under another name",
        source: dedent`
          const mine = handleA;

          export { mine as handle };
        `,
        op: add("handleNew"),
        reason: "re-export",
      },
      {
        name: "an import passed through",
        source: dedent`
          import { handle } from './x';

          export { handle };
        `,
        op: add("handleNew"),
        reason: "re-export",
      },
      {
        name: "export * with no local handle",
        source: `export * from './hooks';`,
        op: add("handleNew"),
        reason: "re-export",
      },
      {
        name: "export * as handle",
        source: `export * as handle from './hooks';`,
        op: remove("handleA"),
        reason: "re-export",
      },
      {
        name: "a handle that is not exported",
        source: `const handle = handleA;`,
        op: add("handleNew"),
        reason: "not-exported",
      },
      {
        name: "a function handle that is not exported",
        source: `function handle({ event, resolve }) { return resolve(event); }`,
        op: remove("handleA"),
        reason: "not-exported",
      },
      {
        name: "a destructured handle",
        source: `export const { handle } = makeHooks();`,
        op: add("handleNew"),
        reason: "destructured",
      },
      {
        name: "a renamed destructured handle",
        source: `export const { hooks: handle } = makeHooks();`,
        op: remove("handleA"),
        reason: "destructured",
      },
      {
        name: "a default-exported function",
        source: `export default function handle({ event, resolve }) { return resolve(event); }`,
        op: add("handleNew"),
        reason: "default-export",
      },
      {
        name: "a handle with no initializer",
        source: `export let handle;`,
        op: add("handleNew"),
        reason: "no-initializer",
      },
      {
        name: "a local sequence function",
        source: dedent`
          function sequence(...handles) { return handles[0]; }

          export const handle = handleA;
        `,
        op: add("handleNew"),
        reason: "foreign-sequence",
      },
      {
        name: "a sequence imported from elsewhere",
        source: dedent`
          import { sequence } from './my-sequence';

          export const handle = sequence(handleA, handleB);
        `,
        op: add("handleNew"),
        reason: "foreign-sequence",
      },
      {
        name: "a function handle beside a handleApp",
        source: dedent`
          const handleApp = 1;

          export function handle({ event, resolve }) { return resolve(event); }
        `,
        op: add("handleNew"),
        reason: "name-collision",
      },
      {
        name: "an arrow handle sharing its statement",
        source: `export const handle = async ({ event, resolve }) => resolve(event), other = 1;`,
        op: add("handleNew"),
        reason: "multi-declarator",
      },
      {
        name: "adding a handle referenced inside a conditional",
        source: `export const handle = dev ? handleA : handleB;`,
        op: add("handleA"),
        reason: "ambiguous-reference",
      },
      {
        name: "removing a handle referenced inside a conditional",
        source: `export const handle = dev ? handleA : handleB;`,
        op: remove("handleA"),
        reason: "ambiguous-reference",
      },
      {
        name: "removing a handle wrapped in another call",
        source: dedent`
          import { sequence } from '@sveltejs/kit/hooks';

          export const handle = sequence(handleB, wrap(handleA));
        `,
        op: remove("handleA"),
        reason: "ambiguous-reference",
      },
      {
        name: "adding a handle a function handle calls itself",
        source: dedent`
          export async function handle({ event, resolve }) {
            return handleA({ event, resolve });
          }
        `,
        op: add("handleA"),
        reason: "ambiguous-reference",
      },
      {
        name: "removing a handle a function handle calls itself",
        source: dedent`
          export async function handle({ event, resolve }) {
            return handleA({ event, resolve });
          }
        `,
        op: remove("handleA"),
        reason: "ambiguous-reference",
      },
    ];

  for (const { name, source, op, reason } of cases) {
    it(name, () => {
      const { text, results } = run(source, [op]);
      expect(statuses(results)).toEqual([reason]);
      expect(text).toBe(source);
    });
  }

  it("still removes from a module with export * beside a local handle", () => {
    const { results } = run(
      dedent`
        export * from './other';

        export const handle = handleA;
      `,
      [remove("handleA")],
    );
    expect(statuses(results)).toEqual(["changed"]);
  });
});

describe("properties over every supported shape", () => {
  for (const { name, source } of SUPPORTED) {
    describe(name, () => {
      it("add is idempotent", () => {
        const once = run(source, [add("handleNew")]);
        const twice = run(source, [add("handleNew"), add("handleNew")]);
        expect(statuses(twice.results)).toEqual(["changed", "unchanged"]);
        expect(twice.text).toBe(once.text);
      });

      it("remove is idempotent", () => {
        const once = run(source, [add("handleNew"), remove("handleNew")]);
        const twice = run(source, [
          add("handleNew"),
          remove("handleNew"),
          remove("handleNew"),
        ]);
        expect(statuses(twice.results)).toEqual([
          "changed",
          "changed",
          "unchanged",
        ]);
        expect(twice.text).toBe(once.text);
      });

      for (const position of ["first", "last"] as const) {
        it(`add then remove (${position}) round-trips`, async () => {
          const { text } = run(source, [
            add("handleNew", position),
            remove("handleNew"),
          ]);
          await expect(text).toMatchFormatted(source, "hooks.server.ts");
        });
      }

      it("two handles, removed in either order, round-trip", async () => {
        const inOrder = run(source, [
          add("handleNew"),
          add("handleOther", "last"),
          remove("handleNew"),
          remove("handleOther"),
        ]);
        const reversed = run(source, [
          add("handleNew"),
          add("handleOther", "last"),
          remove("handleOther"),
          remove("handleNew"),
        ]);
        await expect(inOrder.text).toMatchFormatted(source, "hooks.server.ts");
        await expect(reversed.text).toMatchFormatted(source, "hooks.server.ts");
      });

      it("keeps both handles in order", () => {
        const { handles } = run(source, [
          add("handleNew"),
          add("handleOther", "last"),
        ]);
        expect(handles?.[0]).toBe("handleNew");
        expect(handles?.[handles.length - 1]).toBe("handleOther");
      });
    });
  }
});

describe("comments", () => {
  const COMMENTED = dedent`
    import { sequence } from '@sveltejs/kit/hooks';

    export const handle = sequence(
      handleNegotiate, // negotiation
      // pocketbase
      handlePocketbase({ a: 1 }),
      handleWuchale,
    );
  `;

  it("a removed argument takes its trailing comment", async () => {
    const { text } = run(COMMENTED, [remove("handleNegotiate")]);
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          // pocketbase
          handlePocketbase({ a: 1 }),
          handleWuchale,
        );
      `,
      "hooks.server.ts",
    );
  });

  it("a removed argument takes the comment above it", async () => {
    const { text } = run(COMMENTED, [remove("handlePocketbase")]);
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          handleNegotiate, // negotiation
          handleWuchale,
        );
      `,
      "hooks.server.ts",
    );
  });

  it("a new first argument goes above the old first one's comment", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          // negotiation
          handleNegotiate,
          handleWuchale,
        );
      `,
      [add("handleNew")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          handleNew,
          // negotiation
          handleNegotiate,
          handleWuchale,
        );
      `,
      "hooks.server.ts",
    );
  });

  it("a comment before the closing paren stays with the last argument", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          handleA,
          handleB,
          // more to come
        );
      `,
      [add("handleNew", "last")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          handleA,
          handleB, // more to come
          handleNew,
        );
      `,
      "hooks.server.ts",
    );
  });

  it("the argument left over keeps its comments above the statement", async () => {
    const { text } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(
          handleNegotiate,
          // pocketbase
          handlePocketbase({ a: 1 }),
        );
      `,
      [remove("handleNegotiate")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        // pocketbase
        export const handle = handlePocketbase({ a: 1 });
      `,
      "hooks.server.ts",
    );
  });

  it("removing the last handle takes the comment lines above it", async () => {
    const { text } = run(
      dedent`
        import { a } from 'a';

        const before = 1;

        // The i18n handle.
        // Second line.
        export const handle = handleWuchale; // trailing

        const after = 2;
      `,
      [remove("handleWuchale")],
    );
    await expect(text).toMatchFormatted(
      dedent`
        import { a } from 'a';

        const before = 1;

        const after = 2;
      `,
      "hooks.server.ts",
    );
  });

  it("a comment separated by a blank line stays", async () => {
    const { text } = run(
      dedent`
        // Server hooks.

        export const handle = handleWuchale;
      `,
      [remove("handleWuchale")],
    );
    await expect(text).toMatchFormatted(
      `// Server hooks.\n`,
      "hooks.server.ts",
    );
  });
});

describe("listHandles", () => {
  it("is null without a handle", () => {
    expect(run("", []).handles).toBeNull();
  });

  it("flattens nested sequences into callee and identifier names", () => {
    const { handles } = run(
      dedent`
        import { sequence } from '@sveltejs/kit/hooks';

        export const handle = sequence(handleA, sequence(handleB({}), (x) => x));
      `,
      [],
    );
    expect(handles).toEqual(["handleA", "handleB", "(x) => x"]);
  });

  it("names a function handle `handle`", () => {
    const { handles } = run(
      `export function handle({ event, resolve }) { return resolve(event); }`,
      [],
    );
    expect(handles).toEqual(["handle"]);
  });
});
