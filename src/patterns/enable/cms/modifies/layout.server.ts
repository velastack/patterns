import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import { Node } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import type { ImportSpec } from "../../../../runtime/ts-morph-helpers";
import {
  ensureImportSpec,
  ensureNamedImports,
  findFinalReturn,
  findLoadFunction,
  hasProperty,
  inspectEventParameter,
  newProject,
  returnedObject,
} from "./load-function";

export interface LayoutServerLocale {
  /**
   * Expression passed as `locale` to `loadCms`, given the name of the load's
   * event parameter: `() => "'en'"` or `(event) => \`getLocale(${event}.url)\``.
   */
  expression: (eventName: string) => string;
  /** Imports the expression depends on. */
  imports?: ImportSpec[];
}

/** A single-locale site: the literal default locale. */
export const DEFAULT_LOCALE: LayoutServerLocale = {
  expression: () => "'en'",
};

/** A wuchale site: the locale enable-i18n's reroute already resolved from the URL. */
export const WUCHALE_LOCALE: LayoutServerLocale = {
  expression: (eventName) => `getLocale(${eventName}.url)`,
  imports: [
    { namedImports: ["getLocale"], moduleSpecifier: "$locales/main.url" },
  ],
};

function cmsSnippet(eventName: string, locale: string): string {
  return dedent`
    const { cms, notFound, gone, redirectTo } = await loadCms(${eventName}, { locale: ${locale} });
    if (redirectTo) redirect(308, redirectTo);
    if (gone) error(410, 'Gone');
    if (notFound) error(404, 'Not found');
  `;
}

function importLine(spec: ImportSpec): string {
  const parts: string[] = [];
  if (spec.defaultImport) parts.push(spec.defaultImport);
  if (spec.namespaceImport) parts.push(`* as ${spec.namespaceImport}`);
  if (spec.namedImports?.length)
    parts.push(`{ ${spec.namedImports.join(", ")} }`);
  return `import ${parts.join(", ")} from '${spec.moduleSpecifier}';`;
}

/**
 * A root `+layout.server.ts` written from scratch, for a project that has
 * none — the static template keeps its layout load universal.
 */
export function createdLayoutServer(locale: LayoutServerLocale): string {
  const imports = [
    "import { error, redirect } from '@sveltejs/kit';",
    "import { loadCms } from '$lib/cms';",
    ...(locale.imports ?? []).map(importLine),
    "import type { LayoutServerLoad } from './$types';",
  ].join("\n");
  const snippet = cmsSnippet("event", locale.expression("event"))
    .split("\n")
    .join("\n\t");

  return dedent`
    ${imports}

    export const load: LayoutServerLoad = async (event) => {
    	${snippet}

    	return { cms };
    };
  `.concat("\n");
}

const FAILURE_HINT = [
  "Call loadCms from the root +layout.server.ts load and return `cms`:",
  "",
  createdLayoutServer(DEFAULT_LOCALE).trimEnd(),
  "",
  "loadCms needs the whole event, so a destructured parameter has to become",
  "`event` with the destructuring moved into the body.",
].join("\n");

/**
 * Wires `loadCms` into the root `+layout.server.ts`, creating the file when
 * the project has none:
 *
 * - `loadCms` needs the whole request event, so a destructured parameter is
 *   renamed to `event` and the destructuring becomes the first statement.
 * - The tombstone triple (`redirectTo`, `gone`, `notFound`) is handled just
 *   before the return.
 * - `cms` is added to the returned object, ahead of any spread so nothing
 *   later can shadow it.
 *
 * Anything else — no exported `load`, an expression-bodied arrow, several
 * returns, a non-literal return — is reported as `failed` with the snippet to
 * paste, and the file is left exactly as it was.
 */
export function modifyLayoutServer(
  layoutServerPath: string,
  locale: LayoutServerLocale = DEFAULT_LOCALE,
): ModifyOutcome {
  if (!fs.existsSync(layoutServerPath)) {
    fs.mkdirSync(path.dirname(layoutServerPath), { recursive: true });
    fs.writeFileSync(layoutServerPath, createdLayoutServer(locale));
    return { status: "success", changed: true };
  }

  const original = fs.readFileSync(layoutServerPath, "utf8");
  if (original.includes("loadCms(")) {
    return { status: "success", changed: false };
  }

  const sourceFile = newProject().addSourceFileAtPath(layoutServerPath);

  // --- Inspect everything before touching anything. ---
  const fn = findLoadFunction(sourceFile);
  if (!fn) return { status: "failed", message: FAILURE_HINT };

  const body = fn.getBody();
  if (!body || !Node.isBlock(body)) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const event = inspectEventParameter(fn);
  if (event.kind === "unsupported") {
    return { status: "failed", message: FAILURE_HINT };
  }

  const returned = findFinalReturn(fn, body);
  const object = returned && returnedObject(returned);
  if (!returned || !object) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const eventName = event.kind === "identifier" ? event.name : "event";

  // --- Mutate bottom-up so earlier node references stay valid. ---
  if (!hasProperty(object, "cms")) {
    const spreadIndex = object
      .getProperties()
      .findIndex((property) => Node.isSpreadAssignment(property));
    if (spreadIndex === -1) {
      object.addShorthandPropertyAssignment({ name: "cms" });
    } else {
      object.insertShorthandPropertyAssignment(spreadIndex, { name: "cms" });
    }
  }

  const returnIndex = body.getStatements().indexOf(returned);
  body.insertStatements(
    returnIndex,
    `\n${cmsSnippet(eventName, locale.expression(eventName))}\n`,
  );

  if (event.kind === "binding") {
    const destructuring = event.pattern.getText();
    body.insertStatements(0, `const ${destructuring} = ${eventName};`);
    const typeText = event.param.getTypeNode()?.getText();
    event.param.replaceWithText(
      typeText ? `${eventName}: ${typeText}` : eventName,
    );
  } else if (event.kind === "none") {
    fn.addParameter({ name: eventName });
  }

  if (!fn.isAsync()) fn.setIsAsync(true);

  ensureNamedImports(sourceFile, "@sveltejs/kit", ["error", "redirect"]);
  ensureNamedImports(sourceFile, "$lib/cms", ["loadCms"]);
  for (const spec of locale.imports ?? []) {
    ensureImportSpec(sourceFile, spec);
  }

  sourceFile.formatText();
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
