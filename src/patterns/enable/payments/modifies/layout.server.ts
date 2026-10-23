import fs from "node:fs";
import dedent from "dedent";
import { Node } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  findFinalReturn,
  findLoadFunction,
  hasProperty,
  inspectEventParameter,
  newProject,
  returnedObject,
} from "../../../../runtime/load-function";
import { libModule } from "../../../../runtime/lib-specifier";
import {
  ensureBlankLineAfterImports,
  ensureNamedImport,
  formatLikeSource,
  removeNamedImportIfUnused,
  removeUnusedBindingElement,
} from "../../../../runtime/ts-morph-helpers";

const MODULE = "#lib/currency.server.js";
const PROPERTIES = ["currency", "rates"] as const;

const FAILURE_HINT = dedent`
  Return the visitor's currency and the day's rates from the root +layout.server.ts load:

  import { displayRates } from '#lib/currency.server.js';

  export const load = async ({ locals }) => {
  	return {
  		currency: locals.currency,
  		rates: await displayRates(locals.currency)
  	};
  };

  The load has to be async with a single, final return of an object literal.
`;

/**
 * The root `+layout.server.ts` returns `currency` (what `handleCurrency`
 * resolved) and `rates` (the day's, when it isn't the business's own), so the
 * root layout can start the store before anything renders.
 *
 * A load that isn't async, has no final object-literal return, or receives
 * its event in a way the helpers can't extend is reported as `failed` with
 * the snippet to paste, and the file is left exactly as it was.
 */
export function modifyLayoutServerCurrency(
  layoutServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutServerPath)) {
    return { status: "not-found", message: FAILURE_HINT };
  }
  const original = fs.readFileSync(layoutServerPath, "utf8");
  if (original.includes("displayRates(")) {
    return { status: "success", changed: false };
  }

  const sourceFile = newProject().addSourceFileAtPath(layoutServerPath);
  const fn = findLoadFunction(sourceFile);
  if (!fn) return { status: "failed", message: FAILURE_HINT };
  const body = fn.getBody();
  if (!body || !Node.isBlock(body) || !fn.isAsync()) {
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

  // Where `locals` comes from: the destructured parameter, the event's
  // property, or a parameter added for it.
  let locals = "locals";
  if (event.kind === "identifier") {
    locals = `${event.name}.locals`;
  } else if (event.kind === "binding") {
    const names = event.pattern.getElements().map((e) => e.getName());
    if (!names.includes("locals")) {
      const texts = event.pattern.getElements().map((e) => e.getText());
      event.pattern.replaceWithText(`{ ${[...texts, "locals"].join(", ")} }`);
    }
  } else {
    fn.addParameter({ name: "{ locals }" });
  }

  // After any spread, so nothing in it can shadow these.
  if (!hasProperty(object, "currency")) {
    object.addPropertyAssignment({
      name: "currency",
      initializer: `${locals}.currency`,
    });
  }
  if (!hasProperty(object, "rates")) {
    object.addPropertyAssignment({
      name: "rates",
      initializer: `await displayRates(${locals}.currency)`,
    });
  }
  ensureNamedImport(sourceFile, MODULE, "displayRates");
  formatLikeSource(sourceFile);
  const updated = sourceFile.getFullText();
  fs.writeFileSync(layoutServerPath, updated, "utf8");
  return { status: "success", changed: updated !== original };
}

/** Take `currency` and `rates` back out of the root layout's data. */
export function unmodifyLayoutServerCurrency(
  layoutServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutServerPath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(layoutServerPath, "utf8");
  if (!original.includes("displayRates(")) {
    return { status: "success", changed: false };
  }

  const sourceFile = newProject().addSourceFileAtPath(layoutServerPath);
  const fn = findLoadFunction(sourceFile);
  const body = fn?.getBody();
  const returned =
    fn && body && Node.isBlock(body) ? findFinalReturn(fn, body) : null;
  const object = returned && returnedObject(returned);
  if (!object) {
    return {
      status: "failed",
      message: `Remove currency and rates from the root +layout.server.ts load and the import from '${MODULE}'.`,
    };
  }
  for (const name of PROPERTIES) {
    object.getProperty(name)?.remove();
  }
  removeNamedImportIfUnused(
    sourceFile,
    libModule("currency.server.js"),
    "displayRates",
  );
  removeUnusedBindingElement(sourceFile, "locals");
  ensureBlankLineAfterImports(sourceFile);
  formatLikeSource(sourceFile);
  const updated = sourceFile.getFullText();
  fs.writeFileSync(layoutServerPath, updated, "utf8");
  return { status: "success", changed: updated !== original };
}
