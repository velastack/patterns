import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { detect } from "package-manager-detector";
import { resolveCommand } from "package-manager-detector/commands";
import spawn from "cross-spawn";
import type {
  InstallComponentsOptions,
  InstallComponentsResult,
  Options,
  PackageManagerOperation,
  Result,
  WriteResultRuntime,
} from "../core/types";
import { getLogger, NOOP_LOGGER, type Logger } from "../core/logger";
import { formatSource } from "../core/format-result";
import { FORMSNAP, TANSTACK_TABLE_CORE } from "../core/constants";

type CustomNpmPackages = Record<string, string[]>;

/**
 * The components under `src/ui/components` are copied into a project rather
 * than fetched from the shadcn-svelte registry, so their dependencies have to
 * be declared here: every `$lib/components/ui/<x>` import a component makes
 * must appear in `customDependencies`, and every npm package that no shadcn
 * item installs for it must appear in `customNpmPackages`.
 */
const customDependencies: Record<string, string[]> = {
  "file-form": ["input"],
  multiselect: ["command", "popover", "button"],
  geopoint: ["button", "leaflet"],
  cells: ["badge"],
  "data-table": [],
  "column-header": ["dropdown-menu", "button"],
  "faceted-filter": ["command", "popover", "button", "separator", "badge"],
  pagination: ["button", "select"],
  "row-actions": ["dropdown-menu", "button"],
  leaflet: [],
  "auth-menu": ["dropdown-menu", "button"],
};

const customNpmPackages: CustomNpmPackages = {
  "file-form": [FORMSNAP],
  multiselect: [FORMSNAP],
  geopoint: [],
  cells: [],
  // shadcn-svelte >= 1.2.0 resolves items from the style-scoped registry
  // (/registry/styles/<style>/), which has no `data-table` item, so the
  // TanStack helpers ship from here instead.
  "data-table": [TANSTACK_TABLE_CORE],
  "column-header": [TANSTACK_TABLE_CORE],
  "faceted-filter": [TANSTACK_TABLE_CORE],
  pagination: [TANSTACK_TABLE_CORE],
  "row-actions": [],
  leaflet: ["leaflet", "@types/leaflet"],
};

const customComponentAssets = import.meta.glob<string>("../ui/components/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

function getAllCustomComponents() {
  return [
    ...new Set(
      Object.keys(customComponentAssets).map(componentNameFromAssetPath),
    ),
  ]
    .filter(Boolean)
    .sort();
}

function componentNameFromAssetPath(assetPath: string): string {
  const parts = assetPath.split("/");
  const index = parts.indexOf("components");
  return parts[index + 1] ?? "";
}

function componentRelativeAssetPath(assetPath: string): string {
  const parts = assetPath.split("/");
  const index = parts.indexOf("components");
  return parts.slice(index + 2).join("/");
}

function toTargetPath(root: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.join(root, filePath);
}

function toRelativePath(root: string, filePath: string): string {
  if (path.isAbsolute(filePath)) {
    return path.relative(root, filePath);
  }
  return filePath;
}

function writeFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

function removeFile(filePath: string, root: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  rmSync(filePath, { force: true, recursive: true });
  pruneEmptyDirectories(path.dirname(filePath), root);
}

/**
 * Deleting a feature's files must also delete the directories it added, up
 * to the first one that still has content. The CLI detects features by
 * directory (`src/routes/(app)` means auth is on), so an empty leftover
 * directory keeps a disabled feature "enabled".
 */
function pruneEmptyDirectories(dir: string, root: string): void {
  const stop = path.resolve(root);
  let current = path.resolve(dir);
  while (current !== stop && current.startsWith(stop)) {
    if (!existsSync(current) || readdirSync(current).length > 0) {
      return;
    }
    rmSync(current, { recursive: true, force: true });
    current = path.dirname(current);
  }
}

async function executeWithDetectedPackageManager(
  cwd: string,
  operation: PackageManagerOperation,
  args: string[],
): Promise<void> {
  const packageManager = (await detect({ cwd }))?.name ?? "npm";
  const resolved = resolveCommand(packageManager, operation, args);
  if (!resolved) {
    throw new Error(
      `Unable to resolve ${operation} command for ${packageManager}`,
    );
  }

  const commandArgs = [...resolved.args];
  if (packageManager === "npm") {
    commandArgs.unshift("--yes");
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(resolved.command, commandArgs, {
      cwd,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`${resolved.command} exited with code ${code ?? "unknown"}`),
      );
    });
  });
}

async function executeCommand(
  cwd: string,
  operation: PackageManagerOperation,
  args: string[],
  runtime?: WriteResultRuntime,
): Promise<void> {
  if (runtime?.executeCommand) {
    await runtime.executeCommand(cwd, operation, args);
    return;
  }

  await executeWithDetectedPackageManager(cwd, operation, args);
}

function installedPackagesFromProject(root: string): Set<string> {
  const packageJsonPath = path.join(root, "package.json");
  if (!existsSync(packageJsonPath)) {
    return new Set();
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  return new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]);
}

/**
 * Splits an npm install spec into its package name, dropping any range.
 * `wuchale@^0.26.3` -> `wuchale`, `@wuchale/svelte@^0.21.1` -> `@wuchale/svelte`.
 *
 * The name is what `package.json` records, so it -- not the full spec -- is what
 * the already-installed check has to compare against.
 */
export function packageName(spec: string): string {
  const at = spec.indexOf("@", spec.startsWith("@") ? 1 : 0);
  return at === -1 ? spec : spec.slice(0, at);
}

async function installPackages(
  root: string,
  packages: string[],
  runtime?: WriteResultRuntime,
  logger: Logger = NOOP_LOGGER,
): Promise<string[]> {
  if (packages.length === 0) {
    return [];
  }

  const installed = installedPackagesFromProject(root);
  const toInstall = [...new Set(packages)].filter(
    (pkg) => !installed.has(packageName(pkg)),
  );
  if (toInstall.length === 0) {
    return [];
  }

  logger.info(`Installing packages: ${toInstall.join(", ")}`);
  await executeCommand(root, "install", toInstall, runtime);
  return toInstall;
}

function isCustomComponent(component: string): boolean {
  return getAllCustomComponents().includes(component);
}

function customNpmPackagesFor(components: string[]): string[] {
  return [
    ...new Set(
      components.flatMap((component) => customNpmPackages[component] ?? []),
    ),
  ];
}

function copyCustomComponent(
  component: string,
  targetComponentsDir: string,
): void {
  const targetDir = path.join(targetComponentsDir, component);
  mkdirSync(targetDir, { recursive: true });

  for (const [assetPath, content] of Object.entries(customComponentAssets)) {
    if (componentNameFromAssetPath(assetPath) !== component) {
      continue;
    }
    const relativePath = componentRelativeAssetPath(assetPath);
    if (!relativePath) {
      continue;
    }

    const outputPath = path.join(targetDir, relativePath);
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, content, "utf8");
  }
}

const DEFAULT_UI_DIR = ["src", "lib", "components", "ui"];
const FORMATTABLE_EXTENSIONS = new Set([".ts", ".js", ".svelte", ".json"]);

/**
 * `shadcn-svelte add` writes files in the registry's style and the bundled
 * components carry this repo's; the project's `npm run lint` expects its own.
 * Runs the project's prettier over every file in the installed directories.
 */
async function formatComponentDirs(
  root: string,
  componentsDir: string,
  components: string[],
): Promise<void> {
  const context = { env: "runtime" as const, root };
  for (const component of components) {
    const dir = path.join(componentsDir, component);
    if (!existsSync(dir)) {
      continue;
    }
    const entries = readdirSync(dir, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }
      const filePath = path.join(entry.parentPath, entry.name);
      if (!FORMATTABLE_EXTENSIONS.has(path.extname(filePath))) {
        continue;
      }
      const content = readFileSync(filePath, "utf8");
      const formatted = await formatSource(content, filePath, context);
      if (formatted !== content) {
        writeFileSync(filePath, formatted, "utf8");
      }
    }
  }
}

/**
 * Where shadcn-svelte writes items: `components.json` `aliases.ui`, resolved
 * the way SvelteKit resolves `$lib` (`src/lib`). Anything else (a custom
 * `kit.alias`, a missing or unreadable config) falls back to the default so
 * the existence check here and shadcn's own target agree for every project
 * the CLI creates.
 */
export function resolveUiDir(root: string): string {
  const fallback = path.join(root, ...DEFAULT_UI_DIR);
  const configPath = path.join(root, "components.json");
  if (!existsSync(configPath)) {
    return fallback;
  }
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      aliases?: { ui?: string };
    };
    const alias = config.aliases?.ui;
    if (alias === "$lib") {
      return path.join(root, "src", "lib");
    }
    if (alias?.startsWith("$lib/")) {
      return path.join(root, "src", "lib", ...alias.slice(5).split("/"));
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export async function installComponents(
  options: InstallComponentsOptions,
  runtime?: WriteResultRuntime,
): Promise<InstallComponentsResult> {
  const { root, components, overwrite = false } = options;
  const logger = getLogger(options);

  const requested = [...new Set(components)];
  if (requested.length === 0) {
    return { installed: [], skipped: [], packages: [] };
  }

  const componentsDir = resolveUiDir(root);
  mkdirSync(componentsDir, { recursive: true });
  const isPresent = (component: string) =>
    existsSync(path.join(componentsDir, component));

  const skipped = overwrite ? [] : requested.filter(isPresent);
  const toInstall = requested.filter(
    (component) => !skipped.includes(component),
  );
  if (skipped.length > 0) {
    logger.info(`Already present: ${skipped.join(", ")}`);
  }
  if (toInstall.length === 0) {
    return { installed: [], skipped, packages: [] };
  }

  const customToInstall = new Set(toInstall.filter(isCustomComponent));
  const publicToInstall = new Set(
    toInstall.filter((component) => !isCustomComponent(component)),
  );

  // Dependencies are added only when missing, even under `overwrite`:
  // re-adding `button` because `pagination` was re-added would clobber edits
  // the user never asked to lose.
  for (const component of [...customToInstall]) {
    for (const dependency of customDependencies[component] ?? []) {
      if (isPresent(dependency)) {
        continue;
      }
      if (isCustomComponent(dependency)) {
        customToInstall.add(dependency);
      } else {
        publicToInstall.add(dependency);
      }
    }
  }

  const installed: string[] = [];
  const customList = [...customToInstall].sort();
  if (customList.length > 0) {
    logger.info(`Installing custom components: ${customList.join(", ")}`);
  }
  for (const component of customList) {
    copyCustomComponent(component, componentsDir);
    installed.push(component);
    publicToInstall.delete(component);
  }

  const packages = await installPackages(
    root,
    customNpmPackagesFor(customList),
    runtime,
    logger,
  );

  const publicList = [...publicToInstall].sort();
  if (publicList.length > 0) {
    logger.info(
      `Installing shadcn-svelte components: ${publicList.join(", ")}`,
    );
    await executeCommand(
      root,
      "execute",
      ["shadcn-svelte", "add", "--yes", "--overwrite", ...publicList],
      runtime,
    );
    installed.push(...publicList);
  }

  const installedList = [...new Set(installed)].sort();
  await formatComponentDirs(root, componentsDir, installedList);

  return { installed: installedList, skipped, packages };
}

export async function writeResult(
  result: Result,
  options: Options,
  runtime?: WriteResultRuntime,
): Promise<Result> {
  const logger = getLogger(options);

  const writtenResult: Result = {
    creates: [],
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  };

  let dropMigrationCreates: Result["creates"] = [];
  if (result.collectionDrops.length > 0) {
    const { dropCollections } = await import("./collections");
    dropMigrationCreates = await dropCollections(
      result.collectionDrops,
      options,
    );
  }

  const packageInstalls = await installPackages(
    options.root,
    result.packages,
    runtime,
    logger,
  );

  const componentInstalls = await installComponents(
    { root: options.root, components: result.components, logger },
    runtime,
  );

  for (const file of [...result.creates, ...dropMigrationCreates]) {
    if (file.status !== "success") {
      // A modifier that could not recognise the file it was asked to edit
      // reports `failed` / `not-found` with a paste-ready remediation snippet.
      // Nothing is written, but the entry has to survive into the result: this
      // loop used to `continue` before pushing, so the entry never reached the
      // caller at all and the snippet was lost. The pattern reported success
      // and simply said nothing about the file it had given up on.
      writtenResult.creates.push({
        ...file,
        path: toRelativePath(options.root, file.path),
      });
      continue;
    }
    const target = toTargetPath(options.root, file.path);
    if (!existsSync(target)) {
      writeFile(target, file.content);
      writtenResult.creates.push({
        ...file,
        path: toRelativePath(options.root, file.path),
      });
      continue;
    }
    if (readFileSync(target, "utf8") !== file.content) {
      writeFile(target, file.content);
      writtenResult.modifies.push({
        ...file,
        path: toRelativePath(options.root, file.path),
      });
    }
  }

  for (const file of result.modifies) {
    if (file.status !== "success") {
      // Carried through unwritten, so the caller can report the failure. See
      // the note in the creates loop above.
      writtenResult.modifies.push({
        ...file,
        path: toRelativePath(options.root, file.path),
      });
      continue;
    }
    writeFile(toTargetPath(options.root, file.path), file.content);
    writtenResult.modifies.push({
      ...file,
      path: toRelativePath(options.root, file.path),
    });
  }

  for (const file of result.deletes) {
    if (file.status !== "success") {
      writtenResult.deletes.push({
        ...file,
        path: toRelativePath(options.root, file.path),
      });
      continue;
    }
    if (existsSync(toTargetPath(options.root, file.path))) {
      removeFile(toTargetPath(options.root, file.path), options.root);
      writtenResult.deletes.push({
        ...file,
        path: toRelativePath(options.root, file.path),
      });
    }
  }

  return {
    ...result,
    creates: writtenResult.creates,
    modifies: writtenResult.modifies,
    deletes: writtenResult.deletes,
    components: componentInstalls.installed,
    packages: [...new Set([...packageInstalls, ...componentInstalls.packages])],
  };
}
