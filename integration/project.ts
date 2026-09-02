import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  INTEGRATION_ROOT,
  hardLinkTree,
  projectEnv,
  velaBin,
} from "./baseline";
import { npxBin, run, type RunOptions, type RunResult } from "./exec";

/** Per-project scratch directory for harness logs; sits inside the project. */
export const HARNESS_DIR = ".integration";

export interface Project {
  suite: string;
  name: string;
  root: string;
  /** `<root>/.integration` — command log, step results, svelte-check output. */
  logDir: string;
  logFile: string;
  run(
    command: string,
    args: string[],
    opts?: Partial<Omit<RunOptions, "cwd" | "logFile">>,
  ): RunResult;
}

export function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function projectRoot(suite: string, name: string): string {
  return path.join(INTEGRATION_ROOT, sanitizeName(suite), sanitizeName(name));
}

export function projectHandle(
  suite: string,
  name: string,
  root: string,
): Project {
  const logDir = path.join(root, HARNESS_DIR);
  const logFile = path.join(logDir, "commands.log");
  return {
    suite,
    name,
    root,
    logDir,
    logFile,
    run(command, args, opts = {}) {
      return run(command, args, {
        cwd: root,
        env: projectEnv(opts.env),
        logFile,
        allowFailure: opts.allowFailure,
        input: opts.input,
      });
    },
  };
}

export function keepProjects(): boolean {
  return process.env.INTEGRATION_KEEP === "1";
}

/**
 * Clones a baseline project into a fresh case directory.
 *
 * Everything is a real copy except `node_modules`, which is hard-linked (see
 * `hardLinkTree`). `data/` holds the SQLite database and must never be shared:
 * PocketBase writes it in place.
 */
export function cloneProject(baselineRoot: string, project: Project): void {
  rmSync(project.root, { recursive: true, force: true });
  mkdirSync(path.dirname(project.root), { recursive: true });

  const skip = new Set([
    path.join(baselineRoot, "node_modules"),
    path.join(baselineRoot, HARNESS_DIR),
  ]);
  cpSync(baselineRoot, project.root, {
    recursive: true,
    filter: (source) => !skip.has(source),
  });

  const baselineModules = path.join(baselineRoot, "node_modules");
  if (existsSync(baselineModules)) {
    hardLinkTree(baselineModules, path.join(project.root, "node_modules"));
    // npm rewrites its hidden lockfile in place; give the clone its own copy
    // so an install inside the case cannot leak into the shared baseline.
    const hiddenLock = path.join(
      project.root,
      "node_modules",
      ".package-lock.json",
    );
    if (existsSync(hiddenLock)) {
      const content = readFileSync(hiddenLock, "utf8");
      rmSync(hiddenLock);
      writeFileSync(hiddenLock, content);
    }
    // Vite's dependency cache is per-project state, not a dependency.
    rmSync(path.join(project.root, "node_modules", ".vite"), {
      recursive: true,
      force: true,
    });
  }

  mkdirSync(project.logDir, { recursive: true });
}

export function removeProject(project: Project): void {
  rmSync(project.root, { recursive: true, force: true });
}

/**
 * What `vela create` does for a backend template and `vela enable backend`
 * does not: create the PocketBase superuser and record the credentials in
 * `.env`. Mirrors `velastack-cli/src/lib/pocketbase.ts` (`createSuperuser`)
 * and `src/lib/env.ts` (`writeEnvFile`).
 */
export function bootstrapSuperuser(project: Project): void {
  const dataDir = path.join(project.root, "data");
  const migrationsDir = path.join(project.root, "migrations");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(migrationsDir, { recursive: true });

  project.run(npxBin(), [
    "--yes",
    "pocketbase-server",
    "--dir",
    dataDir,
    "--migrationsDir",
    migrationsDir,
    "superuser",
    "create",
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
  ]);

  const envPath = path.join(project.root, ".env");
  let content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const append = (line: string) => {
    if (content.includes(line)) return;
    if (content.length && !content.endsWith("\n")) content += "\n";
    content += `${line}\n`;
  };
  append("# PocketBase superuser credentials — used by `vela` commands");
  append(`POCKETBASE_SUPERUSER_EMAIL=${ADMIN_EMAIL}`);
  append(`POCKETBASE_SUPERUSER_PASSWORD=${ADMIN_PASSWORD}`);
  writeFileSync(envPath, content);
}

/**
 * The documented next step after `vela enable i18n`: extract strings and let
 * wuchale generate the `src/locales/*` loaders that the pattern's code imports.
 */
export function i18nExtract(project: Project): void {
  project.run(velaBin(), ["i18n", "extract"]);
}
