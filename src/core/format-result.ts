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

/**
 * The target project's own prettier settings (`.prettierrc`, `.editorconfig`,
 * `package.json#prettier`), so pattern output matches what `npm run lint`
 * expects there. Preview runs have no project and use prettier's defaults.
 *
 * The svelte plugin is always supplied as a module: a project's config names
 * it by string, which would resolve relative to this package instead.
 */
async function projectOptions(
  file: Pick<File, "path">,
  context?: FormatContext,
): Promise<prettier.Options> {
  if (context?.env !== "runtime" || !context.root) return {};
  const target = path.isAbsolute(file.path)
    ? file.path
    : path.join(context.root, file.path);
  const resolved = await prettier.resolveConfig(target, { editorconfig: true });
  if (!resolved) return {};
  const plugins = (resolved.plugins ?? []).filter(
    (plugin) => plugin !== "prettier-plugin-svelte",
  );
  return { ...resolved, plugins };
}

/**
 * Formats one source text the way pattern output is formatted; the content
 * comes back unchanged when prettier cannot parse it. Also used for component
 * files that arrive on disk from `shadcn-svelte add` or the bundled
 * components, so `npm run lint` in the project stays clean after an install.
 */
export async function formatSource(
  content: string,
  filePath: string,
  context?: FormatContext,
): Promise<string> {
  try {
    const options = await projectOptions({ path: filePath }, context);
    return await prettier.format(content, {
      ...options,
      filepath: filePath,
      plugins: [...(options.plugins ?? []), sveltePlugin],
    });
  } catch {
    return content;
  }
}

async function formatFile(file: File, context?: FormatContext): Promise<File> {
  if (file.status !== "success" || !canFormatFile(file)) {
    return file;
  }
  return {
    ...file,
    content: await formatSource(file.content, file.path, context),
  };
}

async function formatFiles(
  files: File[],
  context?: FormatContext,
): Promise<File[]> {
  return Promise.all(files.map((file) => formatFile(file, context)));
}

export async function formatResult(
  result: Result,
  context?: FormatContext,
): Promise<Result> {
  const [creates, modifies] = await Promise.all([
    formatFiles(result.creates, context),
    formatFiles(result.modifies, context),
  ]);

  return {
    ...result,
    creates,
    modifies,
  };
}
