import { readFileSync } from "node:fs";
import path from "node:path";
import prettier from "prettier";
import type { File, Options, Result } from "./types";
import sveltePlugin from "prettier-plugin-svelte";

/** What the formatter needs to know about the run: where the project is, and whether it exists at all. */
export type FormatContext = Pick<Options, "env" | "root">;

function canFormatFile(file: File): boolean {
  return (
    file.language === "ts" ||
    file.language === "js" ||
    file.language === "svelte" ||
    file.path.endsWith(".json")
  );
}

function dependsOnPrettier(root: string): boolean {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(root, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Boolean(pkg.dependencies?.prettier || pkg.devDependencies?.prettier);
  } catch {
    return false;
  }
}

/**
 * Whether the project formats with prettier: it depends on it, or prettier
 * finds a config file for the target (a monorepo may keep one at its root).
 * A project with neither, like a bare `sv create`, has a style of its own
 * that prettier's defaults would rewrite in every file a pattern edits.
 */
async function usesPrettier(root: string, target: string): Promise<boolean> {
  if (dependsOnPrettier(root)) return true;
  return (await prettier.resolveConfigFile(target)) !== null;
}

/**
 * The target project's own prettier settings (`.prettierrc`, `.editorconfig`,
 * `package.json#prettier`), so pattern output matches what `npm run lint`
 * expects there; `null` when the project does not use prettier. Preview runs
 * have no project and use prettier's defaults.
 *
 * The svelte plugin is always supplied as a module: a project's config names
 * it by string, which would resolve relative to this package instead.
 */
async function projectOptions(
  file: Pick<File, "path">,
  context?: FormatContext,
): Promise<prettier.Options | null> {
  if (context?.env !== "runtime" || !context.root) return {};
  const target = path.isAbsolute(file.path)
    ? file.path
    : path.join(context.root, file.path);
  if (!(await usesPrettier(context.root, target))) return null;
  const resolved = await prettier.resolveConfig(target, { editorconfig: true });
  if (!resolved) return {};
  const plugins = (resolved.plugins ?? []).filter(
    (plugin) => plugin !== "prettier-plugin-svelte",
  );
  return { ...resolved, plugins };
}

const MAX_FORMAT_PASSES = 3;

/**
 * Formats one source text the way pattern output is formatted; the content
 * comes back unchanged when prettier cannot parse it, or when the project
 * does not use prettier and the file is not `created`. A file a generator
 * created is formatted either way, with prettier's defaults if need be: it
 * relies on formatting for its indentation and has no style of its own to
 * keep. Also used for component files that arrive on disk from
 * `shadcn-svelte add` or the bundled components, so `npm run lint` in the
 * project stays clean after an install.
 */
export async function formatSource(
  content: string,
  filePath: string,
  context?: FormatContext,
  { created = false }: { created?: boolean } = {},
): Promise<string> {
  try {
    const options =
      (await projectOptions({ path: filePath }, context)) ??
      (created ? {} : null);
    if (!options) return content;
    const format = (source: string) =>
      prettier.format(source, {
        ...options,
        filepath: filePath,
        plugins: [...(options.plugins ?? []), sveltePlugin],
      });
    // Prettier is not always idempotent: a long one-line member chain
    // (`await context.admin.collection("x").create({ ... })`) comes out broken
    // across lines on the first pass and joined on the second, which the
    // project's `prettier --check` would flag. Format until it settles.
    let formatted = await format(content);
    for (let pass = 1; pass < MAX_FORMAT_PASSES; pass++) {
      const again = await format(formatted);
      if (again === formatted) break;
      formatted = again;
    }
    return formatted;
  } catch {
    return content;
  }
}

async function formatFile(
  file: File,
  context: FormatContext | undefined,
  created: boolean,
): Promise<File> {
  if (file.status !== "success" || !canFormatFile(file)) {
    return file;
  }
  return {
    ...file,
    content: await formatSource(file.content, file.path, context, { created }),
  };
}

async function formatFiles(
  files: File[],
  context: FormatContext | undefined,
  created: boolean,
): Promise<File[]> {
  return Promise.all(files.map((file) => formatFile(file, context, created)));
}

export async function formatResult(
  result: Result,
  context?: FormatContext,
): Promise<Result> {
  const [creates, modifies] = await Promise.all([
    formatFiles(result.creates, context, true),
    formatFiles(result.modifies, context, false),
  ]);

  return {
    ...result,
    creates,
    modifies,
  };
}
