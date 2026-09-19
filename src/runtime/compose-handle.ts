import {
  Node,
  SyntaxKind,
  ts,
  type CallExpression,
  type Expression,
  type FunctionDeclaration,
  type SourceFile,
  type Statement,
  type VariableDeclaration,
  type VariableStatement,
} from "ts-morph";
import {
  ensureBlankLineAfterImports,
  removeAttachedComments,
  removeNamedImportIfUnused,
  removeStatementWithComments,
} from "./ts-morph-helpers";

/**
 * Composes the server `handle` hook in `hooks.server.ts`.
 *
 * Patterns add and subtract handles in the exported `handle` without caring
 * what shape it is in: a lone expression becomes `sequence(new, old)`, a
 * `sequence(...)` gains or loses an argument, and a handle that is a function
 * is moved to a local `handleApp` so it can take part. Subtracting back to one
 * handle unwraps the `sequence` again, and puts a `handleApp` back the way it
 * was written, so enabling then disabling a pattern round-trips.
 *
 * Nothing here formats or saves: callers do, as they always have. A result of
 * `unsupported` means the file was left exactly as it was found.
 */

const KIT_HOOKS = "@sveltejs/kit/hooks";
const EXTRACTED = "handleApp";

export interface HandleSpec {
  /** Source text of the sequence argument: `handleWuchale`, `handlePocketbase({ ... })`. */
  expression: string;
  /** Identifier, or callee identifier, that marks this handle. Defaults to `expression`. */
  name?: string;
  /** Where it goes in the chain. */
  position?: "first" | "last";
}

export type Unsupported =
  /** `export { handle } from '…'`, `export { x as handle }`, or `export *` with no local handle. */
  | "re-export"
  /** A local `handle` SvelteKit cannot see. */
  | "not-exported"
  /** `export const { handle } = …` */
  | "destructured"
  /** `export default function handle` */
  | "default-export"
  /** `export let handle;` */
  | "no-initializer"
  /** A `sequence` in scope that is not `@sveltejs/kit/hooks`'. */
  | "foreign-sequence"
  /** The handle has to move to `handleApp`, and the name is taken. */
  | "name-collision"
  /** The handle has to move to `handleApp`, and shares its statement with other declarations. */
  | "multi-declarator"
  /** The handle is referenced outside the composition (`dev ? a : handleX`, or inside a function handle). */
  | "ambiguous-reference";

export type ComposeResult =
  /** `statement` is the `handle` declaration, when there still is one. */
  | { status: "changed"; statement?: Statement }
  | { status: "unchanged"; statement?: Statement }
  | { status: "unsupported"; reason: Unsupported };

type Site =
  | {
      kind: "variable";
      decl: VariableDeclaration;
      statement: VariableStatement;
      inlineExport: boolean;
    }
  | { kind: "function"; fn: FunctionDeclaration; inlineExport: boolean };

type Located =
  { site: Site | null; starExport: boolean } | { unsupported: Unsupported };

/** A `sequence(...)` argument with the comments that belong to it. */
interface Piece {
  leading: string[];
  text: string;
  trailing: string[];
}

/** How `sequence` from `@sveltejs/kit/hooks` is bound in this file, if at all. */
interface KitSequence {
  local: string | null;
  namespace: string | null;
}

/** Find the exported `handle`, or say why it cannot be composed. */
function locate(sf: SourceFile): Located {
  let exportedBySpecifier = false;
  let starExport = false;

  for (const ed of sf.getExportDeclarations()) {
    const fromModule = ed.getModuleSpecifier() !== undefined;
    if (ed.isNamespaceExport()) {
      if (ed.getNamespaceExport()?.getName() === "handle") {
        return { unsupported: "re-export" };
      }
      if (fromModule) starExport = true;
      continue;
    }
    for (const spec of ed.getNamedExports()) {
      const exported = spec.getAliasNode()?.getText() ?? spec.getName();
      if (exported !== "handle") continue;
      if (fromModule || spec.getName() !== "handle") {
        return { unsupported: "re-export" };
      }
      exportedBySpecifier = true;
    }
  }

  const fn = sf.getFunctions().find((f) => f.getName() === "handle");
  if (fn) {
    if (fn.isDefaultExport()) return { unsupported: "default-export" };
    if (!fn.hasExportKeyword() && !exportedBySpecifier) {
      return { unsupported: "not-exported" };
    }
    return {
      site: { kind: "function", fn, inlineExport: fn.hasExportKeyword() },
      starExport,
    };
  }

  for (const statement of sf.getVariableStatements()) {
    for (const decl of statement.getDeclarations()) {
      const nameNode = decl.getNameNode();
      if (!Node.isIdentifier(nameNode)) {
        const bindsHandle = nameNode
          .getDescendantsOfKind(SyntaxKind.BindingElement)
          .some((el) => el.getNameNode().getText() === "handle");
        if (bindsHandle) return { unsupported: "destructured" };
        continue;
      }
      if (nameNode.getText() !== "handle") continue;
      if (!statement.hasExportKeyword() && !exportedBySpecifier) {
        return { unsupported: "not-exported" };
      }
      if (!decl.getInitializer()) return { unsupported: "no-initializer" };
      return {
        site: {
          kind: "variable",
          decl,
          statement,
          inlineExport: statement.hasExportKeyword(),
        },
        starExport,
      };
    }
  }

  // `export { handle }` naming something that is not a local variable or
  // function: an import passed straight through, or a class.
  if (exportedBySpecifier) return { unsupported: "re-export" };
  return { site: null, starExport };
}

function kitSequence(sf: SourceFile): KitSequence {
  const found: KitSequence = { local: null, namespace: null };
  for (const decl of sf.getImportDeclarations()) {
    if (decl.getModuleSpecifierValue() !== KIT_HOOKS || decl.isTypeOnly()) {
      continue;
    }
    const namespace = decl.getNamespaceImport();
    if (namespace) found.namespace = namespace.getText();
    for (const named of decl.getNamedImports()) {
      if (named.getName() !== "sequence" || named.isTypeOnly()) continue;
      found.local = named.getAliasNode()?.getText() ?? "sequence";
    }
  }
  return found;
}

/** Whether `name` is declared at the top level or imported. */
function isBound(sf: SourceFile, name: string): boolean {
  for (const decl of sf.getImportDeclarations()) {
    if (decl.getDefaultImport()?.getText() === name) return true;
    if (decl.getNamespaceImport()?.getText() === name) return true;
    for (const named of decl.getNamedImports()) {
      if ((named.getAliasNode()?.getText() ?? named.getName()) === name) {
        return true;
      }
    }
  }
  if (sf.getFunction(name) || sf.getClass(name) || sf.getEnum(name)) {
    return true;
  }
  return sf.getVariableDeclarations().some((d) => {
    const nameNode = d.getNameNode();
    if (Node.isIdentifier(nameNode)) return nameNode.getText() === name;
    return nameNode
      .getDescendantsOfKind(SyntaxKind.BindingElement)
      .some((el) => el.getNameNode().getText() === name);
  });
}

/** The callee to write for a new `sequence(...)`, or null when none can be had. */
function sequenceCallee(sf: SourceFile, kit: KitSequence): string | null {
  if (kit.local) return kit.local;
  if (kit.namespace) return `${kit.namespace}.sequence`;
  return isBound(sf, "sequence") ? null : "sequence";
}

function ensureSequenceImport(sf: SourceFile, kit: KitSequence): void {
  if (kit.local || kit.namespace) return;
  const decl = sf
    .getImportDeclarations()
    .find(
      (d) =>
        d.getModuleSpecifierValue() === KIT_HOOKS &&
        !d.isTypeOnly() &&
        !d.getNamespaceImport(),
    );
  if (decl) decl.addNamedImport("sequence");
  else {
    sf.addImportDeclaration({
      namedImports: ["sequence"],
      moduleSpecifier: KIT_HOOKS,
    });
  }
}

function pruneSequenceImport(sf: SourceFile): void {
  // ts-morph takes the blank line after the imports with a removed import.
  const { wasRemoved } = removeNamedImportIfUnused(sf, KIT_HOOKS, "sequence");
  if (wasRemoved) ensureBlankLineAfterImports(sf);
}

function isSequenceCall(node: Node, kit: KitSequence): node is CallExpression {
  if (!Node.isCallExpression(node)) return false;
  const callee = node.getExpression();
  if (Node.isIdentifier(callee)) return callee.getText() === kit.local;
  if (Node.isPropertyAccessExpression(callee)) {
    return (
      kit.namespace !== null &&
      callee.getExpression().getText() === kit.namespace &&
      callee.getName() === "sequence"
    );
  }
  return false;
}

/** Strip `( )`, `satisfies T`, `as T`, `<T>` and `!` down to the composition. */
function unwrap(node: Expression): Expression {
  for (;;) {
    if (
      Node.isParenthesizedExpression(node) ||
      Node.isSatisfiesExpression(node) ||
      Node.isAsExpression(node) ||
      Node.isTypeAssertion(node) ||
      Node.isNonNullExpression(node)
    ) {
      node = node.getExpression();
    } else {
      return node;
    }
  }
}

/** `name`, or a call of `name`: `handleWuchale`, `handlePocketbase({ ... })`. */
function isHandle(node: Node, name: string): boolean {
  if (Node.isIdentifier(node)) return node.getText() === name;
  if (Node.isCallExpression(node)) {
    const callee = node.getExpression();
    return Node.isIdentifier(callee) && callee.getText() === name;
  }
  return false;
}

/** The chain of `sequence` calls down to the argument that is `name`. */
function findInSequence(
  node: Node,
  name: string,
  kit: KitSequence,
): { calls: CallExpression[]; index: number } | null {
  if (!isSequenceCall(node, kit)) return null;
  const args = node.getArguments();
  const index = args.findIndex((arg) => isHandle(arg, name));
  if (index >= 0) return { calls: [node], index };
  for (const arg of args) {
    const inner = findInSequence(arg, name, kit);
    if (inner) return { calls: [node, ...inner.calls], index: inner.index };
  }
  return null;
}

function references(node: Node, name: string): boolean {
  if (Node.isIdentifier(node) && node.getText() === name) return true;
  return node
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some((id) => id.getText() === name);
}

function commentTexts(text: string, ranges: ts.CommentRange[]): string[] {
  return ranges.map((r) => text.slice(r.pos, r.end));
}

/**
 * The arguments of a `sequence(...)` call, each with its comments. A comment
 * after an argument's comma on the same line is that argument's; comments on
 * the lines above an argument are its own too.
 */
function pieces(call: CallExpression): Piece[] {
  const text = call.getSourceFile().getFullText();
  const args = call.getArguments();
  const openParen = call.getFirstChildByKindOrThrow(SyntaxKind.OpenParenToken);
  const closeParen = call.getLastChildByKindOrThrow(SyntaxKind.CloseParenToken);

  const result = args.map((arg, i): Piece => {
    let leadingFrom = openParen.getEnd();
    if (i > 0) {
      const prevComma = args[i - 1].getNextSiblingIfKind(SyntaxKind.CommaToken);
      leadingFrom = prevComma?.getEnd() ?? args[i - 1].getEnd();
      const prevTrailing = ts.getTrailingCommentRanges(text, leadingFrom);
      if (prevTrailing?.length) {
        leadingFrom = prevTrailing[prevTrailing.length - 1].end;
      }
    }
    const leading = (
      ts.getLeadingCommentRanges(text, leadingFrom) ?? []
    ).filter((r) => r.end <= arg.getStart());
    const comma = arg.getNextSiblingIfKind(SyntaxKind.CommaToken);
    const trailing =
      ts.getTrailingCommentRanges(text, comma?.getEnd() ?? arg.getEnd()) ?? [];
    return {
      leading: commentTexts(text, leading),
      text: arg.getText(),
      trailing: commentTexts(text, trailing),
    };
  });

  // Comments on their own lines just before `)` go with the last argument.
  const last = result[result.length - 1];
  if (last) {
    const lastArg = args[args.length - 1];
    let from =
      lastArg.getNextSiblingIfKind(SyntaxKind.CommaToken)?.getEnd() ??
      lastArg.getEnd();
    const sameLine = ts.getTrailingCommentRanges(text, from);
    if (sameLine?.length) from = sameLine[sameLine.length - 1].end;
    const dangling = (ts.getLeadingCommentRanges(text, from) ?? []).filter(
      (r) => r.end <= closeParen.getStart(),
    );
    last.trailing.push(...commentTexts(text, dangling));
  }
  return result;
}

function hasComments(list: Piece[]): boolean {
  return list.some((p) => p.leading.length > 0 || p.trailing.length > 0);
}

function renderCall(callee: string, list: Piece[], multiline: boolean): string {
  if (!multiline && !hasComments(list)) {
    return `${callee}(${list.map((p) => p.text).join(", ")})`;
  }
  const lines = list.map((p) => {
    const leading = p.leading.map((c) => `${c}\n`).join("");
    const trailing = p.trailing.length ? ` ${p.trailing.join(" ")}` : "";
    return `${leading}${p.text},${trailing}`;
  });
  return `${callee}(\n${lines.join("\n")}\n)`;
}

/** A lone argument taken out of a nested `sequence`: its comments go above it. */
function renderAlone(piece: Piece): string {
  const comments = [...piece.leading, ...piece.trailing];
  return comments.map((c) => `${c}\n`).join("") + piece.text;
}

function isMultiline(call: CallExpression): boolean {
  return call
    .getArguments()
    .some((arg, i, args) =>
      i === 0
        ? false
        : arg.getStartLineNumber() !== args[i - 1].getEndLineNumber(),
    );
}

function rewriteSequence(call: CallExpression, list: Piece[]): Node {
  const multiline = isMultiline(call);
  return call.replaceWithText(
    renderCall(call.getExpression().getText(), list, multiline),
  );
}

function handleStatement(site: Site): Statement {
  return site.kind === "function" ? site.fn : site.statement;
}

/** The `handle` statement as it stands now; nodes go stale on every edit. */
function currentStatement(sf: SourceFile): Statement | undefined {
  const located = locate(sf);
  if ("unsupported" in located || !located.site) return undefined;
  return handleStatement(located.site);
}

function changed(sf: SourceFile): ComposeResult {
  return { status: "changed", statement: currentStatement(sf) };
}

function unchanged(site: Site | null): ComposeResult {
  return {
    status: "unchanged",
    statement: site ? handleStatement(site) : undefined,
  };
}

function unsupported(reason: Unsupported): ComposeResult {
  return { status: "unsupported", reason };
}

/**
 * Take the whole `handle` out: its declarator, or its statement with the
 * comments above it, and an `export { handle }` naming it.
 */
function removeWholeHandle(sf: SourceFile, site: Site): void {
  const viaSpecifier = !site.inlineExport;
  if (site.kind === "variable" && site.statement.getDeclarations().length > 1) {
    site.decl.remove();
  } else {
    removeStatementWithComments(sf, handleStatement(site));
  }
  if (!viaSpecifier) return;
  for (const ed of sf.getExportDeclarations()) {
    if (ed.getModuleSpecifier() !== undefined) continue;
    const spec = ed.getNamedExports().find((s) => s.getName() === "handle");
    if (!spec) continue;
    if (ed.getNamedExports().length === 1) ed.remove();
    else spec.remove();
  }
}

/**
 * Move a handle that is a function out of the way: rename it `handleApp`,
 * un-export it, and export `sequence(...)` of it right after, so `handleApp`
 * is declared before anything reads it.
 */
function extract(
  sf: SourceFile,
  site: Site,
  spec: HandleSpec,
  callee: string,
  kit: KitSequence,
): ComposeResult {
  const position = spec.position ?? "first";
  const args =
    position === "first"
      ? [spec.expression, EXTRACTED]
      : [EXTRACTED, spec.expression];
  const exportKeyword = site.inlineExport ? "export " : "";
  const composed = `${exportKeyword}const handle = ${callee}(${args.join(", ")});`;

  if (site.kind === "function") {
    if (site.inlineExport) site.fn.setIsExported(false);
    sf.getFunctionOrThrow("handle").getNameNode()!.replaceWithText(EXTRACTED);
    const fn = sf.getFunctionOrThrow(EXTRACTED);
    sf.insertText(fn.getEnd(), `\n\n${composed}`);
  } else {
    if (site.inlineExport) site.statement.setIsExported(false);
    sf.getVariableDeclarationOrThrow("handle")
      .getNameNode()
      .replaceWithText(EXTRACTED);
    const statement = sf.getVariableStatementOrThrow(EXTRACTED);
    sf.insertText(statement.getEnd(), `\n\n${composed}`);
  }
  ensureSequenceImport(sf, kit);
  return changed(sf);
}

/**
 * After a `sequence` unwraps to `handleApp` alone, put the function back the
 * way `extract` found it: `handleApp` renamed to `handle` and exported, and
 * the `handle = handleApp` statement gone.
 */
function restoreExtracted(sf: SourceFile): void {
  const located = locate(sf);
  if ("unsupported" in located || located.site?.kind !== "variable") return;
  const { decl, statement, inlineExport } = located.site;
  const init = decl.getInitializer();
  if (
    !init ||
    !Node.isIdentifier(init) ||
    init.getText() !== EXTRACTED ||
    decl.getTypeNode() ||
    statement.getDeclarations().length > 1
  ) {
    return;
  }

  const uses = sf
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .filter((id) => id.getText() === EXTRACTED);
  // Its declaration and the one use in `handle`.
  if (uses.length !== 2) return;

  const fn = sf.getFunction(EXTRACTED);
  const variable = sf.getVariableStatements().find((s) => {
    const decls = s.getDeclarations();
    return decls.length === 1 && decls[0].getName() === EXTRACTED;
  });
  const target = fn ?? variable;
  if (!target || target.hasExportKeyword()) return;

  statement.remove();
  if (fn) {
    const restored = sf.getFunctionOrThrow(EXTRACTED);
    restored.getNameNode()!.replaceWithText("handle");
    if (inlineExport) sf.getFunctionOrThrow("handle").setIsExported(true);
  } else {
    const restored = sf.getVariableDeclarationOrThrow(EXTRACTED);
    restored.getNameNode().replaceWithText("handle");
    if (inlineExport) {
      sf.getVariableStatementOrThrow("handle").setIsExported(true);
    }
  }
}

/**
 * Add a handle to the exported `handle`. Already present anywhere in the
 * composition: unchanged. No `handle` yet: `export const handle = <expression>`.
 */
export function addHandle(sf: SourceFile, spec: HandleSpec): ComposeResult {
  const name = spec.name ?? spec.expression;
  const position = spec.position ?? "first";
  const located = locate(sf);
  if ("unsupported" in located) return unsupported(located.unsupported);
  const { site } = located;
  const kit = kitSequence(sf);

  if (!site) {
    if (located.starExport) return unsupported("re-export");
    const blank = sf.getStatementsWithComments().length > 0 ? "\n" : "";
    sf.addStatements(`${blank}export const handle = ${spec.expression};`);
    return changed(sf);
  }

  if (site.kind === "function") {
    if (references(site.fn, name)) return unsupported("ambiguous-reference");
    return extractChecked(sf, site, spec, kit);
  }

  const core = unwrap(site.decl.getInitializerOrThrow());
  if (isHandle(core, name) || findInSequence(core, name, kit)) {
    return unchanged(site);
  }
  if (references(core, name)) return unsupported("ambiguous-reference");

  if (isSequenceCall(core, kit)) {
    const list = pieces(core);
    const piece: Piece = { leading: [], text: spec.expression, trailing: [] };
    if (position === "first") list.unshift(piece);
    else list.push(piece);
    rewriteSequence(core, list);
    return changed(sf);
  }

  if (Node.isArrowFunction(core) || Node.isFunctionExpression(core)) {
    return extractChecked(sf, site, spec, kit);
  }

  const callee = sequenceCallee(sf, kit);
  if (!callee) return unsupported("foreign-sequence");
  const existing = core.getText();
  const args =
    position === "first"
      ? [spec.expression, existing]
      : [existing, spec.expression];
  const multiline = args.some((a) => a.includes("\n"));
  core.replaceWithText(
    renderCall(
      callee,
      args.map((text) => ({ leading: [], text, trailing: [] })),
      multiline,
    ),
  );
  ensureSequenceImport(sf, kit);
  return changed(sf);
}

function extractChecked(
  sf: SourceFile,
  site: Site,
  spec: HandleSpec,
  kit: KitSequence,
): ComposeResult {
  const callee = sequenceCallee(sf, kit);
  if (!callee) return unsupported("foreign-sequence");
  const taken = sf
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some((id) => id.getText() === EXTRACTED);
  if (taken) return unsupported("name-collision");
  if (site.kind === "variable" && site.statement.getDeclarations().length > 1) {
    return unsupported("multi-declarator");
  }
  return extract(sf, site, spec, callee, kit);
}

/**
 * Take a handle out of the exported `handle`. A `sequence` left with one
 * argument unwraps to it; the last handle takes the `handle` export with it.
 */
export function removeHandle(sf: SourceFile, name: string): ComposeResult {
  const located = locate(sf);
  if ("unsupported" in located) return unsupported(located.unsupported);
  const { site } = located;
  if (!site) return unchanged(null);

  if (site.kind === "function") {
    return references(site.fn, name)
      ? unsupported("ambiguous-reference")
      : unchanged(site);
  }

  const kit = kitSequence(sf);
  const core = unwrap(site.decl.getInitializerOrThrow());
  if (isHandle(core, name)) {
    removeWholeHandle(sf, site);
    pruneSequenceImport(sf);
    return changed(sf);
  }

  const found = findInSequence(core, name, kit);
  if (!found) {
    return references(core, name)
      ? unsupported("ambiguous-reference")
      : unchanged(site);
  }

  // Innermost call first; a nested `sequence` emptied by the removal is in
  // turn removed from the one around it.
  const calls = [...found.calls];
  let index = found.index;
  for (;;) {
    const call = calls.pop()!;
    const list = pieces(call);
    list.splice(index, 1);
    const outer = calls[calls.length - 1];

    if (list.length === 0) {
      if (!outer) {
        removeWholeHandle(sf, site);
        break;
      }
      index = outer.getArguments().indexOf(call);
      continue;
    }
    if (list.length === 1 && outer) {
      call.replaceWithText(renderAlone(list[0]));
      break;
    }
    if (list.length === 1) {
      // `handle = sequence(x)` unwraps to `handle = x`, and x's comments move
      // above the statement rather than dangle after the `=`.
      const [kept] = list;
      const comments = [...kept.leading, ...kept.trailing];
      call.replaceWithText(kept.text);
      if (comments.length === 0) restoreExtracted(sf);
      else {
        const statement = currentStatement(sf)!;
        sf.insertText(
          statement.getStart(true),
          comments.map((c) => `${c}\n`).join(""),
        );
      }
      break;
    }
    rewriteSequence(call, list);
    break;
  }

  pruneSequenceImport(sf);
  return changed(sf);
}

/**
 * Swap handle `name` for `spec` in the same place in the chain. When `name`
 * was the whole `handle`, the comments above the statement go too: they
 * described the old handle. With `name` absent this is `addHandle`.
 */
export function replaceHandle(
  sf: SourceFile,
  name: string,
  spec: HandleSpec,
): ComposeResult {
  const newName = spec.name ?? spec.expression;
  const located = locate(sf);
  if ("unsupported" in located) return unsupported(located.unsupported);
  const { site } = located;
  if (!site || site.kind === "function") return addHandle(sf, spec);

  const kit = kitSequence(sf);
  const core = unwrap(site.decl.getInitializerOrThrow());
  if (isHandle(core, newName) || findInSequence(core, newName, kit)) {
    const stale = isHandle(core, name) || findInSequence(core, name, kit);
    return stale ? removeHandle(sf, name) : unchanged(site);
  }

  if (isHandle(core, name)) {
    core.replaceWithText(spec.expression);
    removeAttachedComments(sf, sf.getVariableStatementOrThrow("handle"));
    return changed(sf);
  }

  const found = findInSequence(core, name, kit);
  if (found) {
    const call = found.calls[found.calls.length - 1];
    const list = pieces(call);
    list[found.index] = { ...list[found.index], text: spec.expression };
    rewriteSequence(call, list);
    return changed(sf);
  }
  if (references(core, name)) return unsupported("ambiguous-reference");
  return addHandle(sf, spec);
}

/**
 * The handles in the exported `handle`, in order: each argument's identifier,
 * or its callee's, or its source text. A function handle is `handle` itself.
 * `null` when there is no `handle` to compose.
 */
export function listHandles(sf: SourceFile): string[] | null {
  const located = locate(sf);
  if ("unsupported" in located || !located.site) return null;
  if (located.site.kind === "function") return ["handle"];
  const kit = kitSequence(sf);

  const names = (node: Node): string[] => {
    if (isSequenceCall(node, kit)) return node.getArguments().flatMap(names);
    if (Node.isIdentifier(node)) return [node.getText()];
    if (
      Node.isCallExpression(node) &&
      Node.isIdentifier(node.getExpression())
    ) {
      return [node.getExpression().getText()];
    }
    return [node.getText()];
  };
  return names(unwrap(located.site.decl.getInitializerOrThrow()));
}
