import fs from "node:fs";
import dedent from "dedent";
import {
  Node,
  Project,
  QuoteKind,
  type SourceFile,
  type Statement,
} from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { removeHandle } from "../../../../runtime/compose-handle";
import {
  ensureBlankLineAfterImports,
  pruneUnusedImports,
  removeStatementWithComments,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

const HANDLE_HINT = dedent`
  Take handlePocketbase(...) out of the exported handle in src/hooks.server.ts,
  and its imports from '@velastack/pocketbase' and '$env/dynamic/private'.
`;

const INIT_HINT = dedent`
  The workflows are removed with the backend. Take the startWorker() call out
  of the init hook in src/hooks.server.ts, and its import:

  import { startWorker } from '$lib/server/workflows';
`;

/** Modules only the backend's handle and init import from. */
const BACKEND_MODULES = [
  "@velastack/pocketbase",
  "$env/dynamic/private",
  "$lib/server/workflows",
  "@sveltejs/kit",
  "@sveltejs/kit/hooks",
];

/** `startWorker()`, `await startWorker()` or `return startWorker()`. */
function isStartWorkerCall(node: Node | undefined): boolean {
  if (!node) return false;
  if (Node.isAwaitExpression(node))
    return isStartWorkerCall(node.getExpression());
  if (Node.isExpressionStatement(node) || Node.isReturnStatement(node)) {
    return isStartWorkerCall(node.getExpression());
  }
  return (
    Node.isCallExpression(node) &&
    node.getExpression().getText() === "startWorker" &&
    node.getArguments().length === 0
  );
}

/** A function whose whole body starts the worker. */
function onlyStartsWorker(fn: Node | undefined): boolean {
  if (
    !Node.isArrowFunction(fn) &&
    !Node.isFunctionExpression(fn) &&
    !Node.isFunctionDeclaration(fn)
  ) {
    return false;
  }
  const body = fn.getBody();
  if (!body) return false;
  if (!Node.isBlock(body)) return isStartWorkerCall(body);
  const statements = body.getStatements();
  return statements.length === 1 && isStartWorkerCall(statements[0]);
}

/**
 * The `init` export when all it does is start the workflow worker, the way
 * the minimal template and enable-workflows write it. `"custom"` when an init
 * starts the worker among other things; null when there is nothing to do.
 */
function workerInit(sf: SourceFile): Statement | "custom" | null {
  const fn = sf.getFunction("init");
  const decl = sf.getVariableDeclaration("init");
  const target = fn ?? decl?.getVariableStatement();
  if (!target || !target.getText().includes("startWorker")) return null;
  const onlyWorker = fn
    ? onlyStartsWorker(fn)
    : decl?.getVariableStatement()?.getDeclarations().length === 1 &&
      onlyStartsWorker(decl.getInitializer());
  return onlyWorker ? target : "custom";
}

/**
 * Undo what the backend put in `hooks.server.ts`: the PocketBase handle, and
 * the `init` that starts the workflow worker, which is deleted along with the
 * backend. Whatever else the file holds (i18n, content negotiation) stays; a
 * file with nothing else comes out empty, for the caller to delete.
 */
export function unmodifyHooksServerBackend(
  hooksServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(hooksServerPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (
    !original.includes("handlePocketbase") &&
    !original.includes("startWorker")
  ) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  // Checked before anything changes, so a failure leaves the file as it was.
  if (workerInit(sourceFile) === "custom") {
    return { status: "failed", message: INIT_HINT };
  }

  const removed = removeHandle(sourceFile, "handlePocketbase");
  if (removed.status === "unsupported") {
    return { status: "failed", message: HANDLE_HINT };
  }
  // Looked up again: edits to the file forget the nodes found before them.
  const init = workerInit(sourceFile);
  if (init && init !== "custom") removeStatementWithComments(sourceFile, init);

  pruneUnusedImports(sourceFile, BACKEND_MODULES);
  formatLikeSource(sourceFile);
  ensureBlankLineAfterImports(sourceFile);
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
