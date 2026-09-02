import fs from "node:fs";
import dedent from "dedent";
import { Node } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  findFinalReturn,
  findLoadFunction,
  hasSpreadOf,
  inspectEventParameter,
  newProject,
  returnedObject,
} from "./load-function";

const FAILURE_HINT = dedent`
  Forward the server load's data through the root +layout.ts, so \`cms\` reaches
  the page:

  export const load = async ({ url, data }) => {
    // ...existing code...
    return { ...data, /* existing keys */ };
  };
`;

/**
 * Make a universal root \`+layout.ts\` forward its server load's data.
 *
 * SvelteKit hands a universal load the server load's result as \`data\`, and
 * only what the universal load returns reaches the page. A layout that
 * returns its own object without spreading \`data\` — the static template
 * does — would drop \`cms\` on the floor once \`+layout.server.ts\` exists.
 *
 * No file, or a file without a \`load\`, needs nothing: server data flows
 * through on its own.
 */
export function modifyLayoutUniversal(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const sourceFile = newProject().addSourceFileAtPath(layoutPath);

  const fn = findLoadFunction(sourceFile);
  if (!fn) return { status: "success", changed: false };

  const body = fn.getBody();
  if (!body || !Node.isBlock(body)) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const event = inspectEventParameter(fn);
  if (event.kind === "unsupported") {
    return { status: "failed", message: FAILURE_HINT };
  }

  const returned = findFinalReturn(fn, body);
  if (!returned) return { status: "failed", message: FAILURE_HINT };

  const dataExpression =
    event.kind === "identifier" ? `${event.name}.data` : "data";

  // `return data;` already forwards everything.
  const expression = returned.getExpression();
  if (expression && expression.getText() === dataExpression) {
    return { status: "success", changed: false };
  }

  const object = returnedObject(returned);
  if (!object) return { status: "failed", message: FAILURE_HINT };
  if (hasSpreadOf(object, dataExpression)) {
    return { status: "success", changed: false };
  }

  // --- Mutate bottom-up so earlier node references stay valid. ---
  // First, so the layout's own keys still win over anything the server sent.
  object.insertSpreadAssignment(0, { expression: dataExpression });

  if (event.kind === "binding") {
    const hasData = event.pattern
      .getElements()
      .some((element) => element.getName() === "data");
    if (!hasData) {
      const text = event.pattern.getText();
      event.pattern.replaceWithText(text.replace(/^\{\s*/, "{ data, "));
    }
  } else if (event.kind === "none") {
    fn.addParameter({ name: "{ data }" });
  }

  sourceFile.formatText();
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
