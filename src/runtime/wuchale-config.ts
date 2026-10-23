import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../core/types";

/**
 * `wuchale.config.js`: which library modules the `js` adapter extracts from.
 *
 * The adapter enable-i18n writes covers route modules (`+page.ts`,
 * `+layout.server.ts`, …). Text a visitor reads can also live in `src/lib`,
 * such as the WhatsApp order message in `src/lib/order.ts`, and wuchale only
 * sees a module it is told about. The patterns that write such a module list
 * it here, so enable-i18n includes it when the module already exists, and a
 * pattern enabled after i18n adds its own.
 */
export const TRANSLATED_LIB_FILES = ["src/lib/order.ts"];

const FAILURE_HINT = (files: string[]) =>
  [
    "Add these to the `files` of the js adapter in wuchale.config.js:",
    "",
    ...files.map((file) => `  "${file}",`),
  ].join("\n");

/**
 * `source` with `files` added to (or removed from) the js adapter's `files`
 * array. `changed` is false when every file was already there (or already
 * absent); `null` when the config has no `js({ files: [...] })` to edit.
 */
export function withWuchaleJsFiles(
  source: string,
  files: string[],
  mode: "add" | "remove" = "add",
): { source: string; changed: boolean } | null {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Double },
  });
  const sf = project.createSourceFile("wuchale.config.js", source, {
    overwrite: true,
  });

  const call = sf
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((candidate) => candidate.getExpression().getText() === "js");
  const config = call?.getArguments()[0];
  if (!config || !config.isKind(SyntaxKind.ObjectLiteralExpression)) {
    return null;
  }
  const property = config.getProperty("files");
  const array = property?.isKind(SyntaxKind.PropertyAssignment)
    ? property.getInitializerIfKind(SyntaxKind.ArrayLiteralExpression)
    : undefined;
  if (!array) return null;

  const elements = array.getElements();
  const literal = (element: (typeof elements)[number]) =>
    element.isKind(SyntaxKind.StringLiteral)
      ? element.getLiteralValue()
      : undefined;
  const present = new Set(elements.map(literal));
  // Match the quotes the array already uses.
  const quote = elements[0]?.getText().startsWith("'") ? "'" : '"';

  let changed = false;
  if (mode === "add") {
    for (const file of files) {
      if (present.has(file)) continue;
      array.addElement(`${quote}${file}${quote}`);
      changed = true;
    }
  } else {
    // From the end, so earlier indexes stay valid.
    for (let i = elements.length - 1; i >= 0; i--) {
      const value = literal(elements[i]);
      if (value !== undefined && files.includes(value)) {
        array.removeElement(i);
        changed = true;
      }
    }
  }

  return { source: changed ? sf.getFullText() : source, changed };
}

/** The file-based form of `withWuchaleJsFiles`, for a pattern's modifies. */
export function modifyWuchaleJsFiles(
  configPath: string,
  files: string[],
  mode: "add" | "remove" = "add",
): ModifyOutcome {
  if (!fs.existsSync(configPath)) {
    return { status: "not-found", message: FAILURE_HINT(files) };
  }
  const result = withWuchaleJsFiles(
    fs.readFileSync(configPath, "utf8"),
    files,
    mode,
  );
  if (!result) {
    return mode === "add"
      ? { status: "failed", message: FAILURE_HINT(files) }
      : // Nothing to remove from a config that never listed them.
        { status: "success", changed: false };
  }
  if (result.changed) fs.writeFileSync(configPath, result.source);
  return { status: "success", changed: result.changed };
}
