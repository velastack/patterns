import {
  copyFileSync,
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { npmBin, npxBin, run } from "./exec";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const INTEGRATION_ROOT = path.join(REPO_ROOT, ".integration-tests");
export const CACHE_ROOT = path.join(INTEGRATION_ROOT, ".cache");

export const ADMIN_EMAIL = "admin@example.com";
export const ADMIN_PASSWORD = "integration";

/** `vela create` templates the harness scaffolds from. */
export type Template = "minimal" | "static";

/** The CLI under test: `VELA_BIN` when set, otherwise whatever `vela` is on PATH. */
export function velaBin(): string {
  return process.env.VELA_BIN ?? "vela";
}

/**
 * A generated project pins `vela` to the version of the CLI that created it.
 * Under `VELA_BIN` that version is a local build: unpublished (the install
 * fails) or an older release (its `node_modules/.bin/vela` would shadow the
 * build under test). The harness runs every `vela` command through
 * `velaBin()`, so the dependency is dropped instead. `cacheKey` hashes
 * devDependencies, so these projects get a cache of their own.
 */
function dropVelaDependency(projectRoot: string): void {
  if (!process.env.VELA_BIN) return;
  const file = path.join(projectRoot, "package.json");
  const text = readFileSync(file, "utf8");
  const pkg = JSON.parse(text);
  if (!pkg.devDependencies?.vela) return;
  delete pkg.devDependencies.vela;
  const indent = /^[ \t]+(?=")/m.exec(text)?.[0] ?? "\t";
  writeFileSync(file, JSON.stringify(pkg, null, indent) + "\n");
}

/**
 * Environment for every command run inside a generated project.
 *
 * - `engine-strict` is relaxed because the template's `.npmrc` turns it on and
 *   the Node floor of the generated project's dependencies drifts.
 * - The PocketBase superuser credentials are what `vela create` was given, so
 *   `vela sync` and the patterns' own `withPocketbase` can authenticate.
 */
export function projectEnv(extra?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...process.env,
    npm_config_engine_strict: "false",
    NPM_CONFIG_ENGINE_STRICT: "false",
    POCKETBASE_SUPERUSER_EMAIL: ADMIN_EMAIL,
    POCKETBASE_SUPERUSER_PASSWORD: ADMIN_PASSWORD,
    CI: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
    ...extra,
  };
}

/**
 * Cache key for a generated project's `node_modules`.
 *
 * `vela create` sets `name` from the directory basename, which would bust the
 * cache every run. Hash only the dependency-relevant fields.
 */
export function cacheKey(packageJsonPath: string): string {
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

/**
 * Recursive hard-link copy of a directory: instant and no extra disk space.
 * Files are shared inodes, so nothing may edit a hard-linked file in place;
 * npm and Vite replace files rather than rewriting them, which is why this is
 * safe for `node_modules` and only `node_modules`, minus `GENERATED_MODULES`.
 *
 * Symlinks are recreated as symlinks. `node_modules/.bin` entries are
 * relative symlinks into their packages, and a bin that becomes a hard-linked
 * copy resolves its relative imports from `.bin/` instead (`cp -Rl` does
 * exactly that on Linux, which broke `npx shadcn-svelte` and
 * `npx pocketbase-server` in CI).
 */
export function hardLinkTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isSymbolicLink()) {
      symlinkSync(readlinkSync(source), target);
    } else if (entry.isDirectory()) {
      hardLinkTree(source, target);
    } else {
      linkSync(source, target);
    }
  }
}

/**
 * The one part of `node_modules` that is rewritten in place. SvelteKit 3's
 * sync (the `svelte-kit sync` bin, and the Vite plugin on every dev and build)
 * writes `$app/tsconfig.json`, `$app/tsconfig/service-worker.json`,
 * `$app/types/index.d.ts` (the project's route ids) and `$app/types/env.d.ts`
 * with `fs.writeFileSync`, which truncates the existing inode. Hard-linked,
 * one project's sync would rewrite every other project's copy, and the cache.
 */
export const GENERATED_MODULES = "$app";

/** Removes `node_modules/$app`; `svelte-kit sync` writes it again. */
export function dropGeneratedModules(projectRoot: string): void {
  rmSync(path.join(projectRoot, "node_modules", GENERATED_MODULES), {
    recursive: true,
    force: true,
  });
}

/**
 * Replaces a hard-linked `node_modules/$app` with a real copy of `source`'s,
 * for a project that may resolve its tsconfig before it next syncs.
 */
export function copyGeneratedModules(
  sourceRoot: string,
  projectRoot: string,
): void {
  dropGeneratedModules(projectRoot);
  const source = path.join(sourceRoot, "node_modules", GENERATED_MODULES);
  if (existsSync(source)) {
    cpSync(source, path.join(projectRoot, "node_modules", GENERATED_MODULES), {
      recursive: true,
    });
  }
}

export function restoreCache(
  cacheDir: string,
  projectRoot: string,
  logFile?: string,
) {
  hardLinkTree(
    path.join(cacheDir, "node_modules"),
    path.join(projectRoot, "node_modules"),
  );
  // Caches saved before `saveCache` skipped it still hold a linked `$app`.
  dropGeneratedModules(projectRoot);
  const lockFile = path.join(cacheDir, "package-lock.json");
  if (existsSync(lockFile)) {
    copyFileSync(lockFile, path.join(projectRoot, "package-lock.json"));
  }
}

export function saveCache(
  cacheDir: string,
  projectRoot: string,
  logFile?: string,
) {
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
  mkdirSync(cacheDir, { recursive: true });
  hardLinkTree(
    path.join(projectRoot, "node_modules"),
    path.join(cacheDir, "node_modules"),
  );
  // Unlinks the cache's names only; the project keeps its own `$app`.
  dropGeneratedModules(cacheDir);
  const lockFile = path.join(projectRoot, "package-lock.json");
  if (existsSync(lockFile)) {
    copyFileSync(lockFile, path.join(cacheDir, "package-lock.json"));
  }
}

/**
 * Installs a generated project's dependencies, restoring `node_modules` from
 * the hash-keyed cache when an identical dependency set was installed before.
 * Returns `true` when the cache was used.
 */
export function installWithCache(
  projectRoot: string,
  logFile?: string,
): boolean {
  const key = cacheKey(path.join(projectRoot, "package.json"));
  const cacheDir = path.join(CACHE_ROOT, key);
  const env = projectEnv();

  if (existsSync(path.join(cacheDir, "node_modules"))) {
    restoreCache(cacheDir, projectRoot, logFile);
    // `prepare` only runs on a real install; recreate the part of it that a
    // restored project still needs before anything reads `.svelte-kit/` or
    // resolves `"extends": "$app/tsconfig"`.
    run(npxBin(), ["svelte-kit", "sync"], { cwd: projectRoot, env, logFile });
    return true;
  }

  run(npmBin(), ["install"], { cwd: projectRoot, env, logFile });
  saveCache(cacheDir, projectRoot, logFile);
  return false;
}

/**
 * Scaffolds a project the way a user would: `vela create` with every prompt
 * answered by a flag, then dependency installation.
 *
 * The backend template gets the superuser credentials (`vela create` writes
 * them to `.env` and creates the PocketBase superuser); the static template
 * rejects them.
 */
export function createVelaProject(
  dir: string,
  template: Template,
  logFile?: string,
): void {
  mkdirSync(dir, { recursive: true });
  const args = [
    "create",
    dir,
    "--template",
    template,
    "--name",
    "SvelteKit",
    "--no-install",
  ];
  if (template === "minimal") {
    args.push("--email", ADMIN_EMAIL, "--password", ADMIN_PASSWORD);
  }
  run(velaBin(), args, { cwd: dir, env: projectEnv(), logFile });
  dropVelaDependency(dir);
  installWithCache(dir, logFile);
}

/**
 * A SvelteKit project vela did not create: no shadcn-svelte, tailwind,
 * PocketBase or flash messages. What `ui: "plain"` generators have to work in.
 *
 * `sv@1` is SvelteKit 3: config inline in `sveltekit({...})` in
 * `vite.config.ts` (no `svelte.config.js`), `#lib` package.json imports, a
 * tsconfig extending `$app/tsconfig` and no `src/env.ts`. Pinned to the major
 * so a new one cannot change the baseline under the suite.
 */
export function createBareProject(dir: string, logFile?: string): void {
  mkdirSync(dir, { recursive: true });
  run(
    npxBin(),
    [
      "--yes",
      "sv@1",
      "create",
      dir,
      "--template",
      "minimal",
      "--types",
      "ts",
      "--no-add-ons",
      "--no-install",
    ],
    { cwd: dir, env: projectEnv(), logFile },
  );
  installWithCache(dir, logFile);
}
