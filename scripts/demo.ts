import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { bySlug, patterns } from "../src/index";
import type { Features } from "../src/core/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const INTEGRATION_ROOT = path.join(REPO_ROOT, ".integration-tests");
const CACHE_ROOT = path.join(INTEGRATION_ROOT, ".cache");

const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "password";

/** Pattern slugs that, after running, enable the named feature for subsequent patterns. */
const SLUG_TO_FEATURE: Partial<Record<string, keyof Features>> = {
  "enable-auth": "auth",
  "enable-api": "api",
  "enable-api-keys": "apiKeys",
  "enable-i18n": "i18n",
  "enable-teams": "teams",
};

function usage(): never {
  console.error("Usage: npm run demo -- <category> <name> [argv...] [, <category> <name> [argv...]]...");
  console.error("");
  console.error("Examples:");
  console.error("  npm run demo -- enable auth");
  console.error("  npm run demo -- enable auth, enable teams");
  console.error("  npm run demo -- enable auth, enable api-keys, generate form contact name:text");
  console.error("  npm run demo -- generate scaffold posts title:text body:editor");
  console.error("");
  console.error("Available patterns:");
  for (const p of patterns) {
    console.error(`  ${p.slug}`);
  }
  process.exit(1);
}

function run(command: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...opts });
  if (result.status !== 0) {
    console.error(`\nCommand failed: ${command} ${args.join(" ")}`);
    process.exit(1);
  }
}

function cacheKey(packageJsonPath: string): string {
  // `vela create` sets `name` from the randomized temp dir basename, which
  // would bust the cache every run. Hash only the dependency-relevant fields.
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const keyInput = JSON.stringify({
    dependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
    peerDependencies: pkg.peerDependencies ?? {},
    optionalDependencies: pkg.optionalDependencies ?? {},
    overrides: pkg.overrides ?? {},
    engines: pkg.engines ?? {},
  });
  return createHash("sha256").update(keyInput).digest("hex").slice(0, 16);
}

function restoreCache(cacheDir: string, projectRoot: string) {
  // cp -rl creates a recursive hard-linked copy — instant and zero extra disk space.
  run("cp", ["-rl", path.join(cacheDir, "node_modules"), path.join(projectRoot, "node_modules")]);
  const lockFile = path.join(cacheDir, "package-lock.json");
  if (existsSync(lockFile)) {
    copyFileSync(lockFile, path.join(projectRoot, "package-lock.json"));
  }
}

function saveCache(cacheDir: string, projectRoot: string) {
  mkdirSync(cacheDir, { recursive: true });
  run("cp", ["-rl", path.join(projectRoot, "node_modules"), path.join(cacheDir, "node_modules")]);
  const lockFile = path.join(projectRoot, "package-lock.json");
  if (existsSync(lockFile)) {
    copyFileSync(lockFile, path.join(cacheDir, "package-lock.json"));
  }
}

/**
 * Splits the raw CLI args into one command per comma. Tolerant of whitespace
 * around the comma (`enable auth, enable teams` and `enable auth , enable teams`
 * both work).
 */
function splitCommands(args: string[]): string[][] {
  return args
    .join(" ")
    .split(",")
    .map((cmd) => cmd.trim().split(/\s+/).filter(Boolean))
    .filter((cmd) => cmd.length > 0);
}

interface ParsedCommand {
  slug: string;
  argv: string[];
  pattern: (typeof patterns)[number];
}

function parseCommand(tokens: string[]): ParsedCommand {
  if (tokens.length < 2) {
    console.error(`Invalid command: "${tokens.join(" ")}" — expected <category> <name> [argv...]`);
    usage();
  }
  const [category, name, ...argv] = tokens;
  const slug = `${category}-${name}`;
  const pattern = bySlug[slug as keyof typeof bySlug];
  if (!pattern) {
    console.error(`Pattern not found: ${slug}`);
    usage();
  }
  return { slug, argv, pattern };
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

const commands = splitCommands(args).map(parseCommand);
if (commands.length === 0) usage();

const dirSuffix = commands.map((c) => c.slug.replace(/^(enable|generate)-/, "")).join("+");

mkdirSync(INTEGRATION_ROOT, { recursive: true });
const tempRoot = mkdtempSync(path.join(INTEGRATION_ROOT, `demo-${dirSuffix}-`));

console.log(`\nProject directory: ${tempRoot}`);
console.log(`Patterns: ${commands.map((c) => c.slug).join(" → ")}\n`);

// Always create the project skeleton without installing so we can inspect
// package.json for the cache key before deciding whether to install.
console.log("Running vela create...\n");
const createResult = spawnSync(
  "vela",
  [
    "create",
    tempRoot,
    "--template",
    "minimal",
    "--name",
    "SvelteKit",
    "--email",
    ADMIN_EMAIL,
    "--password",
    ADMIN_PASSWORD,
    "--no-install",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_engine_strict: "false",
      NPM_CONFIG_ENGINE_STRICT: "false",
    },
  },
);

if (createResult.status !== 0) {
  console.error("\nvela create failed, cleaning up...");
  rmSync(tempRoot, { recursive: true, force: true });
  process.exit(1);
}

// Resolve cache based on the generated package.json.
const packageJsonPath = path.join(tempRoot, "package.json");
const key = cacheKey(packageJsonPath);
const cacheDir = path.join(CACHE_ROOT, key);

if (existsSync(path.join(cacheDir, "node_modules"))) {
  console.log(`Restoring node_modules from cache (${key})...\n`);
  restoreCache(cacheDir, tempRoot);
} else {
  console.log("Installing dependencies (will be cached for next run)...\n");
  run("npm", ["install"], {
    cwd: tempRoot,
    env: {
      ...process.env,
      npm_config_engine_strict: "false",
      NPM_CONFIG_ENGINE_STRICT: "false",
    },
  });
  saveCache(cacheDir, tempRoot);
}

process.env.POCKETBASE_SUPERUSER_EMAIL = ADMIN_EMAIL;
process.env.POCKETBASE_SUPERUSER_PASSWORD = ADMIN_PASSWORD;

const prev = process.cwd();
process.chdir(tempRoot);

let features: Features = {
  auth: false,
  api: false,
  apiKeys: false,
  i18n: false,
  teams: false,
  payments: false,
};

for (const [index, { slug, argv, pattern }] of commands.entries()) {
  // Merge in pattern.requires so prerequisites are satisfied even if the user
  // didn't explicitly chain them in the right order.
  features = {
    auth: features.auth || (pattern.requires.auth ?? false),
    api: features.api || (pattern.requires.api ?? false),
    apiKeys: features.apiKeys,
    i18n: features.i18n,
    teams: features.teams,
    payments: features.payments || (pattern.requires.payments ?? false),
  };

  console.log(`\n[${index + 1}/${commands.length}] Applying ${slug}${argv.length ? ` ${argv.join(" ")}` : ""}\n`);

  const result = await pattern.generate({
    argv,
    env: "runtime",
    root: tempRoot,
    features,
    input: {},
  });

  for (const f of result.creates) console.log(`  + ${f.path}`);
  for (const f of result.modifies) console.log(`  ~ ${f.path}`);
  for (const f of result.deletes) console.log(`  - ${f.path}`);
  for (const c of result.components) console.log(`  * component: ${c}`);
  for (const p of result.packages) console.log(`  * package: ${p}`);

  // Mark the feature as enabled for subsequent patterns.
  const featKey = SLUG_TO_FEATURE[slug];
  if (featKey) features[featKey] = true;
}

process.chdir(prev);

console.log(`\nDone. Project: ${tempRoot}`);
