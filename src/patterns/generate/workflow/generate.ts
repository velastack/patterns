import dedent from "dedent";
import type { File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";

export interface WorkflowArgs {
  /** Kebab-case: the workflow's registered name and its file name. */
  name: string;
  /** camelCase: the exported binding. */
  exportName: string;
  cron?: string;
}

const NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CRON_RE = /^\S+(?:\s+\S+){4,5}$/;

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

export function toCamelCase(kebab: string): string {
  return kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** `<name> [--cron <expr>]`, in either order; `--cron=<expr>` works too. */
export function parseWorkflowArgs(argv: string[]): WorkflowArgs {
  let raw: string | undefined;
  let cron: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cron") {
      cron = argv[++i];
      if (cron === undefined) {
        throw new InvalidArgumentError(
          "--cron needs a schedule, e.g. --cron '*/5 * * * *'",
        );
      }
    } else if (arg.startsWith("--cron=")) {
      cron = arg.slice("--cron=".length);
    } else if (arg.startsWith("-")) {
      throw new InvalidArgumentError(`Unknown option: ${arg}`);
    } else if (raw === undefined) {
      raw = arg;
    } else {
      throw new InvalidArgumentError(
        "Invalid command arguments. Expected: <name> [--cron <schedule>]",
      );
    }
  }

  if (!raw) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <name> [--cron <schedule>]",
    );
  }

  const name = toKebabCase(raw);
  if (!NAME_RE.test(name)) {
    throw new InvalidArgumentError(
      `Invalid workflow name: "${raw}". Use letters, numbers and dashes, e.g. send-welcome-email.`,
    );
  }
  if (cron !== undefined && !CRON_RE.test(cron.trim())) {
    throw new InvalidArgumentError(
      `Invalid cron schedule: "${cron}". Expected five fields, e.g. '*/5 * * * *'.`,
    );
  }

  return { name, exportName: toCamelCase(name), cron: cron?.trim() };
}

function workflowSnippet({ name, exportName }: WorkflowArgs): string {
  return dedent`
    import { z } from 'zod';
    import { ow } from '$lib/server/workflows';

    /**
     * Start a run from any server code with \`${exportName}.run(input)\`. Runs
     * are listed under Workflows in the PocketBase dashboard.
     */
    export const ${exportName} = ow.defineWorkflow(
      {
        name: '${name}',
        // What \`run()\` takes, checked before the run is queued.
        schema: z.object({}),
        retryPolicy: { maximumAttempts: 3 }
      },
      async ({ input, step }) => {
        // Each step's return value is saved, so a retry or a restart carries on
        // after the last step that finished. Keep every step safe to repeat.
        const result = await step.run({ name: 'first-step' }, async () => {
          return input;
        });
        return result;
      }
    );
  `;
}

function cronWorkflowSnippet({ name, exportName, cron }: WorkflowArgs): string {
  return dedent`
    import { ow } from '$lib/server/workflows';

    /**
     * Runs on the schedule below; \`${exportName}.run()\` starts an extra run.
     * Runs are listed under Workflows in the PocketBase dashboard.
     */
    export const ${exportName} = ow.defineWorkflow(
      { name: '${name}', retryPolicy: { maximumAttempts: 3 } },
      async ({ step }) => {
        // Each step's return value is saved, so a retry or a restart carries on
        // after the last step that finished. Keep every step safe to repeat.
        await step.run({ name: 'first-step' }, async () => {
          // ...
        });
      }
    );

    /** Every workflow in this file starts on this schedule, once per minute across all servers. */
    export const cron = '${cron}';
  `;
}

function testSnippet({ name, exportName, cron }: WorkflowArgs): string {
  const run = cron ? `${exportName}.run()` : `${exportName}.run({})`;
  // A workflow that returns nothing completes with a null output.
  const expectation = cron ? "resolves.toBeNull()" : "resolves.toEqual({})";
  return dedent`
    import { afterAll, beforeAll, describe, expect, it } from 'vitest';
    import { startWorker, stopWorker } from '$lib/server/workflows';
    import { ${exportName} } from './${name}';

    describe('${name}', () => {
      // The test process runs a worker of its own, so a run completes here
      // without going through the dev server.
      beforeAll(() => startWorker());
      afterAll(() => stopWorker());

      it('completes', async () => {
        const handle = await ${run};
        await expect(handle.result({ timeoutMs: 15_000 })).${expectation};
      });
    });
  `;
}

function toFile(path: string, content: string): File {
  return {
    path,
    language: languageFromPath(path),
    content: `${content}\n`,
    status: "success",
  };
}

export async function generate(options: Options): Promise<Result> {
  const args = parseWorkflowArgs(options.argv);
  const dir = `src/lib/workflows`;

  const creates = [
    toFile(
      `${dir}/${args.name}.ts`,
      args.cron ? cronWorkflowSnippet(args) : workflowSnippet(args),
    ),
    // Named to match the `server` filter `vela test:server` runs by default.
    toFile(`${dir}/${args.name}.server.test.ts`, testSnippet(args)),
  ];

  return {
    creates,
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
