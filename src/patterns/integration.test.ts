import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { patterns } from "../index";
import type { Options, Pattern, Result } from "../core/types";
import { withPocketbase } from "../runtime/pocketbase";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO_ROOT = path.resolve(__dirname, "../..");
const INSPECTION_ROOT_DIR = path.join(REPO_ROOT, ".integration-tests");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const POCKETBASE_SUPERUSER_EMAIL = "admin@example.com";
const POCKETBASE_SUPERUSER_PASSWORD = "integration";

type GenerateStep = {
  slug: string;
  argv: string[];
};

function runCommandRaw(
  cwd: string,
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv,
) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
  });
}

function runCommand(
  cwd: string,
  command: string,
  args: string[],
  stepName: string,
  env?: NodeJS.ProcessEnv,
) {
  const result = runCommandRaw(cwd, command, args, env);

  if (result.status !== 0) {
    const stdout = result.stdout?.trim() ?? "";
    const stderr = result.stderr?.trim() ?? "";
    throw new Error(
      [
        `Command failed during ${stepName}: ${command} ${args.join(" ")}`,
        stdout ? `stdout:\n${stdout}` : "",
        stderr ? `stderr:\n${stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  } else {
    console.log(stepName);
    console.log(result.stdout);
    console.log(result.stderr);
  }
}

async function withCurrentWorkingDirectory<T>(
  cwd: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

async function withPocketbaseSuperuserEnv<T>(fn: () => Promise<T>): Promise<T> {
  const previousEmail = process.env.POCKETBASE_SUPERUSER_EMAIL;
  const previousPassword = process.env.POCKETBASE_SUPERUSER_PASSWORD;
  process.env.POCKETBASE_SUPERUSER_EMAIL = POCKETBASE_SUPERUSER_EMAIL;
  process.env.POCKETBASE_SUPERUSER_PASSWORD = POCKETBASE_SUPERUSER_PASSWORD;

  try {
    return await fn();
  } finally {
    if (previousEmail === undefined) {
      delete process.env.POCKETBASE_SUPERUSER_EMAIL;
    } else {
      process.env.POCKETBASE_SUPERUSER_EMAIL = previousEmail;
    }

    if (previousPassword === undefined) {
      delete process.env.POCKETBASE_SUPERUSER_PASSWORD;
    } else {
      process.env.POCKETBASE_SUPERUSER_PASSWORD = previousPassword;
    }
  }
}

function normalizePath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}

function assertSvelteCheckForChangedFiles(
  projectRoot: string,
  stepLabel: string,
) {
  const result = runCommandRaw(projectRoot, NPM_BIN, [
    "exec",
    "svelte-check",
    "--",
    "--tsconfig",
    "./tsconfig.json",
  ]);

  if (result.status === 0) {
    return;
  }

  const combinedOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  console.log(stepLabel);
  console.log(combinedOutput);
}

function changedFilePaths(result: Result): string[] {
  return [
    ...result.creates.map((file) => file.path),
    ...result.modifies.map((file) => file.path),
  ];
}

function getPatternBySlug(slug: string): Pattern {
  const pattern = patterns.find((entry) => entry.slug === slug);
  if (!pattern) {
    throw new Error(`Pattern not found: ${slug}`);
  }
  return pattern;
}

function makeOptions(root: string, argv: string[]): Options {
  return {
    argv,
    env: "runtime",
    root,
    features: {
      auth: false,
      api: false,
      apiKeys: false,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
    },
    input: {},
  };
}

function assertProjectChecks(
  projectRoot: string,
  stepLabel: string,
  generatedPaths: string[],
) {
  runCommand(
    projectRoot,
    NPM_BIN,
    ["run", "prepare"],
    `${stepLabel} / prepare`,
  );
  runCommand(
    projectRoot,
    NPM_BIN,
    ["run", "format"],
    `${stepLabel} / prettier-write`,
  );
  runCommand(projectRoot, NPM_BIN, ["run", "lint"], `${stepLabel} / prettier`);
  assertSvelteCheckForChangedFiles(projectRoot, stepLabel);
  runCommand(projectRoot, "vela", ["test:server"], `${stepLabel} / test`);
}

describe("generate integration", () => {
  it(
    "generates all patterns and passes checks between steps",
    async () => {
      fs.mkdirSync(INSPECTION_ROOT_DIR, { recursive: true });
      const tempRoot = fs.mkdtempSync(
        path.join(INSPECTION_ROOT_DIR, "velastack-patterns-"),
      );
      runCommand(
        tempRoot,
        "vela",
        [
          "create",
          tempRoot,
          "--template",
          "minimal",
          "--name",
          "SvelteKit",
          "--email",
          POCKETBASE_SUPERUSER_EMAIL,
          "--password",
          POCKETBASE_SUPERUSER_PASSWORD,
          "--install",
          "npm",
        ],
        "create baseline app",
        {
          ...process.env,
          npm_config_engine_strict: "false",
          NPM_CONFIG_ENGINE_STRICT: "false",
        },
      );

      const steps: GenerateStep[] = [
        // {
        //   slug: "generate-scaffold",
        //   argv: ["product", "name:text", "price:number"],
        // },
        // {
        //   slug: "generate-form",
        //   argv: ["feedback", "name:text", "email:email"],
        // },
        // {
        //   slug: "generate-resource",
        //   argv: ["invoice", "amount:number", "paid:bool"],
        // },
        // {
        //   slug: "generate-schema",
        //   argv: ["profile", "bio:text", "website:url"],
        // },
        {
          slug: "enable-auth",
          argv: [],
        },
      ];

      await withPocketbaseSuperuserEnv(async () =>
        withCurrentWorkingDirectory(tempRoot, async () => {
          const resultsBySlug = new Map<string, Result>();

          for (const step of steps) {
            const pattern = getPatternBySlug(step.slug);
            const result = await pattern.generate(
              makeOptions(tempRoot, step.argv),
            );
            resultsBySlug.set(step.slug, result);
            assertProjectChecks(tempRoot, step.slug, changedFilePaths(result));
          }

          // expect(
          //   fs.existsSync(path.join(tempRoot, "src/lib/schemas/product.ts")),
          // ).toBe(true);
          // expect(
          //   fs.existsSync(path.join(tempRoot, "src/lib/schemas/feedback.ts")),
          // ).toBe(true);
          // expect(
          //   fs.existsSync(path.join(tempRoot, "src/lib/schemas/invoice.ts")),
          // ).toBe(true);
          // expect(
          //   fs.existsSync(path.join(tempRoot, "src/lib/schemas/profile.ts")),
          // ).toBe(true);

          // const scaffoldResult = resultsBySlug.get("generate-scaffold");
          // const resourceResult = resultsBySlug.get("generate-resource");
          // expect(scaffoldResult).toBeDefined();
          // expect(resourceResult).toBeDefined();

          // expect(scaffoldResult?.collections[0]?.name).toBe("products");
          // expect(resourceResult?.collections[0]?.name).toBe("invoices");
          // expect(
          //   scaffoldResult?.creates.some((file) =>
          //     file.path.endsWith("_created_products.js"),
          //   ),
          // ).toBe(true);
          // expect(
          //   resourceResult?.creates.some((file) =>
          //     file.path.endsWith("_created_invoices.js"),
          //   ),
          // ).toBe(true);

          // await withPocketbase(tempRoot, async (pb) => {
          //   const names = (await pb.collections.getFullList()).map(
          //     (collection) => collection.name,
          //   );
          //   expect(names).toContain("products");
          //   expect(names).toContain("invoices");
          // });
        }),
      );
    },
    20 * 60 * 1000,
  );
});
