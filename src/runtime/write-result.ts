import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { detect } from "package-manager-detector";
import { resolveCommand } from "package-manager-detector/commands";
import spawn from "cross-spawn";
import type { Options, Result } from "../core/types";
import { getLogger, NOOP_LOGGER, type Logger } from "../core/logger";

type PackageManagerOperation = "execute" | "install";
type ExecuteCommand = (
  cwd: string,
  operation: PackageManagerOperation,
  args: string[],
) => Promise<void>;

interface WriteResultRuntime {
  executeCommand?: ExecuteCommand;
}

type CustomNpmPackages = Record<string, string[]>;

const customDependencies: Record<string, string[]> = {
  "file-form": ["input", "form"],
  multiselect: ["command", "popover", "button", "badge"],
  geopoint: ["button", "leaflet"],
  cells: [],
  "column-header": ["dropdown-menu", "button"],
  "faceted-filter": ["command", "popover", "button", "separator", "badge"],
  pagination: ["button", "select"],
  "row-actions": ["dropdown-menu", "button"],
  leaflet: [],
  "auth-menu": ["dropdown-menu", "button"],
};

const customNpmPackages: CustomNpmPackages = {
  "file-form": [],
  multiselect: [],
  geopoint: [],
  cells: [],
  "column-header": ["@tanstack/table-core"],
  "faceted-filter": ["@tanstack/table-core"],
  pagination: ["@tanstack/table-core"],
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

function writeFile(filePath: string, content: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

function removeFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  rmSync(filePath, { force: true, recursive: true });
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
  const toInstall = [...new Set(packages)].filter((pkg) => !installed.has(pkg));
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

async function installComponents(
  root: string,
  components: string[],
  runtime?: WriteResultRuntime,
  logger: Logger = NOOP_LOGGER,
): Promise<{ components: string[]; packages: string[] }> {
  if (components.length === 0) {
    return { components: [], packages: [] };
  }

  const componentsDir = path.join(root, "src", "lib", "components", "ui");
  mkdirSync(componentsDir, { recursive: true });

  const requested = [...new Set(components)];
  const missing = requested.filter(
    (component) => !existsSync(path.join(componentsDir, component)),
  );

  if (missing.length === 0) {
    return { components: [], packages: [] };
  }

  const customToInstall = new Set(missing.filter(isCustomComponent));
  const publicToInstall = new Set(
    missing.filter((component) => !isCustomComponent(component)),
  );

  for (const component of [...customToInstall]) {
    for (const dependency of customDependencies[component] ?? []) {
      if (existsSync(path.join(componentsDir, dependency))) {
        continue;
      }
      if (isCustomComponent(dependency)) {
        customToInstall.add(dependency);
      } else {
        publicToInstall.add(dependency);
      }
    }
  }

  const installedComponents: string[] = [];
  const customList = [...customToInstall].sort();
  if (customList.length > 0) {
    logger.info(`Installing custom components: ${customList.join(", ")}`);
  }
  for (const component of customList) {
    copyCustomComponent(component, componentsDir);
    installedComponents.push(component);
    publicToInstall.delete(component);
  }

  const customPackages = await installPackages(
    root,
    customNpmPackagesFor([...customToInstall]),
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
    installedComponents.push(...publicList);
  }

  return {
    components: [...new Set(installedComponents)],
    packages: customPackages,
  };
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
    options.root,
    result.components,
    runtime,
    logger,
  );

  for (const file of [...result.creates, ...dropMigrationCreates]) {
    if (file.status !== "success") continue;
    if (!existsSync(toTargetPath(options.root, file.path))) {
      writeFile(toTargetPath(options.root, file.path), file.content);
      writtenResult.creates.push(file);
    }
  }

  for (const file of result.modifies) {
    if (file.status !== "success") continue;
    writeFile(toTargetPath(options.root, file.path), file.content);
  }

  for (const file of result.deletes) {
    if (file.status !== "success") continue;
    if (existsSync(toTargetPath(options.root, file.path))) {
      removeFile(toTargetPath(options.root, file.path));
      writtenResult.deletes.push(file);
    }
  }

  return {
    ...result,
    creates: writtenResult.creates,
    deletes: writtenResult.deletes,
    components: componentInstalls.components,
    packages: [...new Set([...packageInstalls, ...componentInstalls.packages])],
  };
}
