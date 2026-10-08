import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind, type SourceFile } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { formatLikeSource } from "../../../../runtime/ts-morph-helpers";

const LOAD_LINE =
  "const subscription = await loadActiveSubscription(locals, user.id);";

const NOT_FOUND_HINT = [
  "Create src/routes/(app)/+layout.server.ts before enabling subscriptions.",
  "Enable auth first — the (app) layout is provided by the velastack-auth baseline.",
].join("\n");

const failureHint = (helper: string) =>
  [
    "Could not find the user and the returned object in the (app) layout load.",
    "Add the active subscription to it by hand:",
    "",
    helper,
    "",
    "// In load, once `user` is set:",
    LOAD_LINE,
    "// ...and return it with the rest:",
    "return { ..., subscription };",
  ].join("\n");

/**
 * The `loadActiveSubscription` helper, taken from the preview template so the
 * docs and what gets written stay the same.
 */
function helperFrom(template: string): string {
  const clean = template.replace(
    /^[ \t]*\/\/[ \t]*\[!code highlight:\d+\][ \t]*\r?\n/gm,
    "",
  );
  const start = clean.indexOf("async function loadActiveSubscription");
  const end = clean.indexOf("\n}\n", start);
  if (start === -1 || end === -1) {
    throw new Error("No loadActiveSubscription in the layout template");
  }
  return clean.slice(start, end + 2);
}

function findLoad(sf: SourceFile) {
  const varDecl = sf.getVariableDeclaration("load");
  if (varDecl?.getVariableStatement()?.hasExportKeyword()) {
    const init = varDecl.getInitializer();
    const fn =
      varDecl.getInitializerIfKind(SyntaxKind.ArrowFunction) ??
      init?.getFirstDescendantByKind(SyntaxKind.ArrowFunction) ??
      init?.getFirstDescendantByKind(SyntaxKind.FunctionExpression);
    if (fn) return { fn, statement: varDecl.getVariableStatement()! };
  }
  const fn = sf.getFunction("load");
  return fn?.isExported() ? { fn, statement: fn } : undefined;
}

/**
 * Adds the active subscription to the (app) layout's data: the
 * `loadActiveSubscription` helper, a call to it in `load`, and `subscription`
 * in what `load` returns. Edits the file rather than replacing it, so what
 * other patterns put in the load (teams' `team`/`teams`, say) stays.
 */
export function modifyAppLayoutServer(
  filePath: string,
  template: string,
): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes("loadActiveSubscription")) {
    return { status: "success", changed: false };
  }

  const helper = helperFrom(template);
  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sf = project.addSourceFileAtPath(filePath);
  const load = findLoad(sf);
  const body = load?.fn.getBody();
  if (!load || !body || body.getKind() !== SyntaxKind.Block) {
    return { status: "failed", message: failureHint(helper) };
  }
  const block = body.asKindOrThrow(SyntaxKind.Block);

  // The call needs `locals` and `user`, and goes before the return.
  const params = load.fn.getParameters();
  const binding = params[0]?.getNameNode();
  const hasLocals =
    binding?.getKind() === SyntaxKind.ObjectBindingPattern &&
    binding
      .asKindOrThrow(SyntaxKind.ObjectBindingPattern)
      .getElements()
      .some((el) => el.getName() === "locals");
  const userIndex = block.getStatements().findIndex(
    (s) =>
      s.getKind() === SyntaxKind.VariableStatement &&
      s
        .asKindOrThrow(SyntaxKind.VariableStatement)
        .getDeclarations()
        .some((d) => d.getName() === "user"),
  );
  const statements = block.getStatements();
  const ret = [...statements]
    .reverse()
    .find((s) => s.getKind() === SyntaxKind.ReturnStatement)
    ?.asKind(SyntaxKind.ReturnStatement);
  const returned = ret
    ?.getExpression()
    ?.asKind(SyntaxKind.ObjectLiteralExpression);
  if (!hasLocals || userIndex === -1 || !ret || !returned) {
    return { status: "failed", message: failureHint(helper) };
  }

  block.insertStatements(statements.indexOf(ret), LOAD_LINE);
  if (!returned.getProperty("subscription")) {
    const text = returned.getText();
    if (text.includes("\n")) {
      returned.addShorthandPropertyAssignment({ name: "subscription" });
    } else {
      // Kept on one line, as written.
      returned.replaceWithText(text.replace(/\s*\}$/, ", subscription }"));
    }
  }
  if (!load.fn.isAsync()) load.fn.setIsAsync(true);
  sf.insertStatements(sf.getStatements().indexOf(load.statement), (writer) =>
    writer.write(helper).blankLine(),
  );

  formatLikeSource(sf);
  sf.saveSync();
  return { status: "success", changed: sf.getFullText() !== original };
}
