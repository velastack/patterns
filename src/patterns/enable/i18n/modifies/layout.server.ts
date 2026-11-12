import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import { Node, type ObjectLiteralExpression } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  findFinalReturn,
  findLoadFunction,
  hasProperty,
  inspectEventParameter,
  newProject,
  returnedObject,
} from "../../../../runtime/load-function";
import { formatLikeSource } from "../../../../runtime/ts-morph-helpers";

/**
 * The whole file, for a project that had no root `+layout.server.ts`.
 * `disable-i18n` deletes it again while it is still exactly this.
 */
export const LAYOUT_SERVER_SNIPPET = dedent`
  import type { LayoutServerLoad } from './$types';

  export const load: LayoutServerLoad = async ({ locals }) => {
  	// Decided on the server (src/hooks.server.ts), because pages without a
  	// language in their URL follow the visitor's preference.
  	return { locale: locals.locale };
  };
`;

const FAILURE_HINT = [
  "Return the request's language from the load in src/routes/+layout.server.ts:",
  "",
  "return {",
  "  // ...what it returns today",
  "  locale: locals.locale",
  "};",
].join("\n");

/** The object a load yields: its final `return`, or an arrow's `({ ... })` body. */
function loadResult(
  fn: NonNullable<ReturnType<typeof findLoadFunction>>,
): ObjectLiteralExpression | null {
  const body = fn.getBody();
  if (!body) return null;
  if (Node.isBlock(body)) {
    const returned = findFinalReturn(fn, body);
    return returned ? returnedObject(returned) : null;
  }
  let expression: Node = body;
  while (Node.isParenthesizedExpression(expression)) {
    expression = expression.getExpression();
  }
  return Node.isObjectLiteralExpression(expression) ? expression : null;
}

/**
 * The root layout's server load returns `locale`, the language the hook chose
 * for the request, for `+layout.ts` and the language select to read. Created
 * when the project has no `+layout.server.ts`; otherwise the property joins
 * what the load returns already. A load with several returns, or one that
 * returns something other than an object literal, is reported as `failed`
 * with the line to add and left as it was.
 */
export function modifyLayoutServerLocale(
  layoutServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutServerPath)) {
    fs.mkdirSync(path.dirname(layoutServerPath), { recursive: true });
    fs.writeFileSync(layoutServerPath, LAYOUT_SERVER_SNIPPET + "\n");
    return { status: "success", changed: true };
  }

  const original = fs.readFileSync(layoutServerPath, "utf8");
  if (original.includes("locals.locale")) {
    return { status: "success", changed: false };
  }

  const sourceFile = newProject().addSourceFileAtPath(layoutServerPath);
  const fn = findLoadFunction(sourceFile);
  if (!fn) {
    // Route options only (`export const prerender = true`, say).
    if (/\bload\b/.test(original)) {
      return { status: "failed", message: FAILURE_HINT };
    }
    sourceFile.addStatements(
      "\n" + LAYOUT_SERVER_SNIPPET.split("\n").slice(2).join("\n") + "\n",
    );
    sourceFile.insertStatements(0, LAYOUT_SERVER_SNIPPET.split("\n")[0]);
    formatLikeSource(sourceFile);
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  const event = inspectEventParameter(fn);
  const object = loadResult(fn);
  if (
    event.kind === "unsupported" ||
    !object ||
    hasProperty(object, "locale")
  ) {
    return { status: "failed", message: FAILURE_HINT };
  }

  let locals = "locals";
  if (event.kind === "identifier") {
    locals = `${event.name}.locals`;
  } else if (event.kind === "none") {
    fn.addParameter({ name: "{ locals }" });
  } else {
    const elements = event.pattern.getElements();
    const existing = elements.find(
      (element) =>
        (element.getPropertyNameNode()?.getText() ?? element.getName()) ===
        "locals",
    );
    if (existing) {
      locals = existing.getName();
    } else if (elements.some((element) => element.getDotDotDotToken())) {
      return { status: "failed", message: FAILURE_HINT };
    } else {
      const kept = elements.map((element) => element.getText());
      event.pattern.replaceWithText(`{ ${["locals", ...kept].join(", ")} }`);
    }
  }

  // After any spread, so nothing spread in can shadow it.
  object.addPropertyAssignment({
    name: "locale",
    initializer: `${locals}.locale`,
    leadingTrivia: (writer) =>
      writer
        .writeLine(
          "// Decided on the server (src/hooks.server.ts), because pages without a",
        )
        .writeLine("// language in their URL follow the visitor's preference."),
  });

  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
