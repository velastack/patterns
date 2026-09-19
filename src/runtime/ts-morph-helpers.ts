import {
  Node,
  Project,
  QuoteKind,
  SyntaxKind,
  type ImportDeclarationStructure,
  type OptionalKind,
  type SourceFile,
  type Statement,
  type StringLiteral,
} from "ts-morph";

export interface ImportSpec {
  defaultImport?: string;
  namespaceImport?: string;
  namedImports?: string[];
  moduleSpecifier: string;
}

/**
 * Run a function with an in-memory ts-morph SourceFile and return the resulting
 * source plus whatever the callback returned.
 */
export function withInMemoryScript<T>(
  source: string,
  fn: (sf: SourceFile) => T,
): { source: string; result: T } {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sf = project.createSourceFile("script.ts", source, { overwrite: true });
  const result = fn(sf);
  return { source: sf.getFullText(), result };
}

/** Add the given imports to the source file, skipping any whose module specifier already exists. */
export function ensureImports(sf: SourceFile, imports: ImportSpec[]): void {
  for (const spec of imports) {
    const existing = sf
      .getImportDeclarations()
      .find((d) => d.getModuleSpecifierValue() === spec.moduleSpecifier);
    if (existing) continue;

    const structure: OptionalKind<ImportDeclarationStructure> = {
      moduleSpecifier: spec.moduleSpecifier,
    };
    if (spec.defaultImport) structure.defaultImport = spec.defaultImport;
    if (spec.namespaceImport) structure.namespaceImport = spec.namespaceImport;
    if (spec.namedImports) structure.namedImports = spec.namedImports;
    sf.addImportDeclaration(structure);
  }
}

/** Remove the import declaration for the given module specifier, if present. */
export function removeImportByModuleSpecifier(
  sf: SourceFile,
  moduleSpecifier: string,
): { wasRemoved: boolean } {
  const decl = sf
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (!decl) return { wasRemoved: false };
  decl.remove();
  return { wasRemoved: true };
}

/**
 * Whether `local` is used anywhere other than the import that binds it.
 * Conservative: a same-named property counts, which only ever keeps an import.
 */
export function isReferenced(sf: SourceFile, local: string): boolean {
  return sf.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => {
    if (id.getText() !== local) return false;
    const kind = id.getParent()?.getKind();
    return (
      kind !== SyntaxKind.ImportSpecifier &&
      kind !== SyntaxKind.ImportClause &&
      kind !== SyntaxKind.NamespaceImport
    );
  });
}

/**
 * Drop `name` from the import of `moduleSpecifier` once nothing else in the
 * file references it; the whole declaration goes when `name` was its only
 * import. For unwrapping `sequence(...)` and the like after a revert. An
 * aliased import (`sequence as seq`) is checked by its local name.
 */
export function removeNamedImportIfUnused(
  sf: SourceFile,
  moduleSpecifier: string,
  name: string,
): { wasRemoved: boolean } {
  const decl = sf
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (!decl) return { wasRemoved: false };

  const named = decl.getNamedImports().find((ni) => ni.getName() === name);
  if (!named) return { wasRemoved: false };

  const local = named.getAliasNode()?.getText() ?? name;
  if (isReferenced(sf, local)) return { wasRemoved: false };

  if (decl.getNamedImports().length === 1 && !decl.getDefaultImport()) {
    decl.remove();
  } else {
    named.remove();
  }
  return { wasRemoved: true };
}

/**
 * Drop every binding imported from `moduleSpecifiers` that nothing references
 * any more, and the declaration once it binds nothing. Side-effect imports
 * (`import 'x'`) bind nothing to begin with and are left alone.
 */
export function pruneUnusedImports(
  sf: SourceFile,
  moduleSpecifiers: string[],
): { removed: string[] } {
  const removed: string[] = [];
  for (const decl of sf.getImportDeclarations()) {
    if (!moduleSpecifiers.includes(decl.getModuleSpecifierValue())) continue;
    if (!decl.getImportClause()) continue;

    for (const named of decl.getNamedImports()) {
      const local = named.getAliasNode()?.getText() ?? named.getName();
      if (isReferenced(sf, local)) continue;
      named.remove();
      removed.push(local);
    }
    const defaultImport = decl.getDefaultImport();
    if (defaultImport && !isReferenced(sf, defaultImport.getText())) {
      removed.push(defaultImport.getText());
      decl.removeDefaultImport();
    }
    const namespaceImport = decl.getNamespaceImport();
    if (namespaceImport && !isReferenced(sf, namespaceImport.getText())) {
      removed.push(namespaceImport.getText());
      decl.removeNamespaceImport();
    }

    if (
      decl.getNamedImports().length === 0 &&
      !decl.getDefaultImport() &&
      !decl.getNamespaceImport()
    ) {
      decl.remove();
    }
  }
  return { removed };
}

/**
 * Import `name` from `moduleSpecifier`, joining an existing import of that
 * module. A type-only name joins a value import as an inline `type`
 * specifier; an `import type` declaration already covers it.
 */
export function ensureNamedImport(
  sf: SourceFile,
  moduleSpecifier: string,
  name: string,
  typeOnly = false,
): void {
  const existing = sf
    .getImportDeclarations()
    .find(
      (d) =>
        d.getModuleSpecifierValue() === moduleSpecifier &&
        !d.getNamespaceImport() &&
        (typeOnly || !d.isTypeOnly()),
    );
  if (!existing) {
    sf.addImportDeclaration({
      isTypeOnly: typeOnly,
      namedImports: [name],
      moduleSpecifier,
    });
    return;
  }
  if (existing.getNamedImports().some((ni) => ni.getName() === name)) return;
  existing.addNamedImport(
    typeOnly && !existing.isTypeOnly() ? { name, isTypeOnly: true } : name,
  );
}

function isCommentNode(node: Node): boolean {
  const kind = node.getKind();
  return (
    kind === SyntaxKind.SingleLineCommentTrivia ||
    kind === SyntaxKind.MultiLineCommentTrivia
  );
}

function newlines(text: string): number {
  return (text.match(/\n/g) ?? []).length;
}

/**
 * The comment lines directly above a top-level statement, up to the first
 * blank line. ts-morph parses them as statements of their own; the JSDoc is
 * not among them, it belongs to the statement.
 */
function commentsAbove(sf: SourceFile, statement: Statement): Statement[] {
  const siblings = sf.getStatementsWithComments();
  const text = sf.getFullText();
  const comments: Statement[] = [];
  let cursor = statement.getStart(true);
  for (let i = siblings.indexOf(statement) - 1; i >= 0; i--) {
    const node = siblings[i];
    if (!isCommentNode(node)) break;
    if (newlines(text.slice(node.getEnd(), cursor)) > 1) break;
    comments.unshift(node);
    cursor = node.getStart();
  }
  return comments;
}

/**
 * Remove the JSDoc and comment lines directly above a top-level statement,
 * leaving the statement. For a statement whose comment describes something
 * that has just been swapped out.
 */
export function removeAttachedComments(
  sf: SourceFile,
  statement: Statement,
): void {
  const comments = commentsAbove(sf, statement);
  const spacing = spacingAround(sf, comments[0] ?? statement);
  if (Node.isJSDocable(statement)) {
    for (const doc of statement.getJsDocs()) doc.remove();
  }
  for (const comment of comments.reverse()) comment.remove();
  spacing.restore(statement);
}

/**
 * Remove a top-level statement together with its JSDoc, the comment lines
 * directly above it and a comment trailing its last line. ts-morph's own
 * `remove()` leaves the comment lines behind as orphans.
 */
export function removeStatementWithComments(
  sf: SourceFile,
  statement: Statement,
): void {
  const comments = commentsAbove(sf, statement);
  const siblings = sf.getStatementsWithComments();
  const next = siblings[siblings.indexOf(statement) + 1];
  const spacing = spacingAround(sf, comments[0] ?? statement);
  statement.remove();
  for (const comment of comments.reverse()) comment.remove();
  if (next) spacing.restore(next);
}

/**
 * ts-morph takes the blank line before a removed statement or comment with
 * it. Note whether `first` (the start of what is about to go) was set off by
 * one, so `restore` can put it back before whatever follows.
 */
function spacingAround(sf: SourceFile, first: Statement) {
  const siblings = sf.getStatementsWithComments();
  const prev = siblings[siblings.indexOf(first) - 1];
  const setOff =
    prev !== undefined &&
    newlines(sf.getFullText().slice(prev.getEnd(), first.getStart(true))) > 1;
  return {
    restore(next: Statement) {
      if (!setOff || !prev) return;
      const gap = sf.getFullText().slice(prev.getEnd(), next.getStart(true));
      if (newlines(gap) < 2) sf.insertText(prev.getEnd(), "\n");
    },
  };
}

/**
 * True when the file has no statements left: only comments and whitespace,
 * or nothing at all. A revert that empties a file it once created reports
 * the file as a delete instead.
 */
export function isEffectivelyEmpty(sf: SourceFile): boolean {
  return sf.compilerNode.statements.every(
    (s) => s.kind === SyntaxKind.EmptyStatement,
  );
}

/**
 * Keep one blank line between the import block and what follows. Removing
 * statements right after the imports takes the separating blank line with
 * them, and prettier preserves whichever spacing it finds.
 */
export function ensureBlankLineAfterImports(sf: SourceFile): void {
  const imports = sf.getImportDeclarations();
  const last = imports[imports.length - 1];
  const next = last?.getNextSibling();
  if (!last || !next) return;
  // Up to the next statement's JSDoc, whose own newlines are no blank line.
  const between = sf.getFullText().slice(last.getEnd(), next.getStart(true));
  if ((between.match(/\n/g) ?? []).length >= 2) return;
  sf.insertText(last.getEnd(), "\n");
}

/** A component's `let { ... } = $props()` declaration, if it destructures. */
function propsDeclaration(sf: SourceFile) {
  return sf
    .getVariableDeclarations()
    .find(
      (decl) =>
        decl.getInitializer()?.getText() === "$props()" &&
        Node.isObjectBindingPattern(decl.getNameNode()),
    );
}

/** The `{ ... }` of a component's `let { ... } = $props()`, if it has one. */
function propsBinding(sf: SourceFile) {
  return propsDeclaration(sf)
    ?.getNameNode()
    .asKind(SyntaxKind.ObjectBindingPattern);
}

/**
 * Make sure a Svelte component's `$props()` destructures `name`, for markup a
 * modifier inserts that reads it. Adds a `$props()` declaration when the
 * component has none.
 */
export function ensurePropsBinding(sf: SourceFile, name: string): void {
  const binding = propsBinding(sf);
  if (!binding) {
    sf.addStatements(`let { ${name} } = $props();`);
    return;
  }
  const elements = binding.getElements();
  if (elements.some((e) => e.getName() === name)) return;
  const texts = elements.map((e) => e.getText());
  const rest = elements.findIndex((e) => e.getDotDotDotToken());
  texts.splice(rest === -1 ? texts.length : rest, 0, name);
  binding.replaceWithText(`{ ${texts.join(", ")} }`);
}

/**
 * Drop `name` from a Svelte component's `$props()` once neither the script
 * nor `markup` reads it, undoing `ensurePropsBinding`. The declaration stays
 * even when it empties, as `let {} = $props()` is harmless.
 */
export function removePropsBindingIfUnused(
  sf: SourceFile,
  name: string,
  markup: string,
): void {
  // Only expressions read it: `{data.user}`, `{data}`, `x={data.y}`. A bare
  // word match would also catch `data-role` attributes and body text.
  const reads = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`);
  const expressions =
    markup.replace(/<style[\s\S]*?<\/style>/g, "").match(/\{[^{}]*\}/g) ?? [];
  if (expressions.some((expression) => reads.test(expression))) return;
  const decl = propsDeclaration(sf);
  const binding = propsBinding(sf);
  const element = binding
    ?.getElements()
    .find((e) => e.getName() === name && !e.getPropertyNameNode());
  if (!decl || !binding || !element) return;
  // Outside the declaration itself, whose type may name the prop too.
  const usedInScript = sf
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some(
      (id) =>
        id.getText() === name && !decl.containsRange(id.getPos(), id.getEnd()),
    );
  if (usedInScript) return;
  const kept = binding
    .getElements()
    .filter((e) => e !== element)
    .map((e) => e.getText());
  binding.replaceWithText(`{ ${kept.join(", ")} }`);
}

/**
 * Drop a destructured `name` (as in `({ locals, url })`) that nothing in the
 * file reads any more, for reverting an edit that was its last use. A
 * parameter left as a bare `{}` goes, as does a `const {} = ...` statement.
 * Conservative: any other identifier spelled `name` keeps it.
 */
export function removeUnusedBindingElement(sf: SourceFile, name: string): void {
  const element = sf
    .getDescendantsOfKind(SyntaxKind.BindingElement)
    .find(
      (e) =>
        e.getName() === name &&
        !e.getPropertyNameNode() &&
        !e.getDotDotDotToken(),
    );
  if (!element) return;
  const nameNode = element.getNameNode();
  const referenced = sf
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .some((id) => id.getText() === name && id !== nameNode);
  if (referenced) return;

  const pattern = element.getParentIfKindOrThrow(
    SyntaxKind.ObjectBindingPattern,
  );
  const kept = pattern
    .getElements()
    .filter((e) => e !== element)
    .map((e) => e.getText());
  const owner = pattern.getParent();
  if (kept.length === 0 && Node.isParameterDeclaration(owner)) {
    owner.remove();
  } else if (kept.length === 0 && Node.isVariableDeclaration(owner)) {
    owner.getVariableStatement()?.remove();
  } else {
    pattern.replaceWithText(`{ ${kept.join(", ")} }`);
  }
}

/**
 * Remove a top-level function or variable declaration by name, if present.
 * In a statement that declares several variables only `name`'s declarator
 * goes; the statement goes with its last one.
 */
export function removeTopLevelStatementByIdentifier(
  sf: SourceFile,
  name: string,
): { wasRemoved: boolean } {
  const fn = sf.getFunction(name);
  if (fn) {
    fn.remove();
    return { wasRemoved: true };
  }
  const decl = sf
    .getVariableStatements()
    .flatMap((s) => s.getDeclarations())
    .find((d) => d.getName() === name);
  if (decl) {
    decl.remove();
    return { wasRemoved: true };
  }
  return { wasRemoved: false };
}

/**
 * Add an item to the `data.navUser` array in a Svelte component's script body.
 * Idempotent: if an entry with the same `title` already exists, no-op.
 */
export function addNavItemToScript(
  scriptSource: string,
  title: string,
  url: string,
  icon: string,
  iconImportPath: string,
): { source: string; wasAdded: boolean } {
  const newNavItemSnippet = `
        {
            title: '${title}',
            url: '${url}',
            icon: ${icon}
        }
    `.trim();

  const { source, result } = withInMemoryScript(scriptSource, (sf) => {
    const dataDecl = sf
      .getVariableDeclarations()
      .find((d) => d.getName() === "data");
    const dataInit = dataDecl?.getInitializer();
    if (
      !dataInit ||
      dataInit.getKind() !== SyntaxKind.ObjectLiteralExpression
    ) {
      return { wasAdded: false };
    }

    const obj = dataInit.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const navProp = obj.getProperty("navUser");
    if (!navProp || navProp.getKind() !== SyntaxKind.PropertyAssignment) {
      return { wasAdded: false };
    }

    const init = navProp
      .asKindOrThrow(SyntaxKind.PropertyAssignment)
      .getInitializer();
    if (!init || init.getKind() !== SyntaxKind.ArrayLiteralExpression) {
      return { wasAdded: false };
    }

    const arr = init.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    const exists = arr.getElements().some((el) => {
      if (el.getKind() !== SyntaxKind.ObjectLiteralExpression) return false;
      const o = el.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
      const titleProp = o.getProperty("title");
      if (!titleProp || titleProp.getKind() !== SyntaxKind.PropertyAssignment) {
        return false;
      }
      const value = titleProp
        .asKindOrThrow(SyntaxKind.PropertyAssignment)
        .getInitializer();
      return (
        value?.getKind() === SyntaxKind.StringLiteral &&
        (value as StringLiteral).getLiteralText() === title
      );
    });

    if (exists) return { wasAdded: false };

    ensureImports(sf, [
      { defaultImport: icon, moduleSpecifier: iconImportPath },
    ]);
    arr.addElement(newNavItemSnippet);
    sf.formatText();
    return { wasAdded: true };
  });

  return { source, wasAdded: result.wasAdded };
}

/**
 * Remove the entry with the given `title` from the `data.navUser` array in a
 * Svelte component's script body. Also removes the icon import if supplied and
 * no other navUser entry references it. Idempotent: no-op if the entry or
 * navUser structure is missing.
 */
export function removeNavItemFromScript(
  scriptSource: string,
  title: string,
  iconImportPath?: string,
): { source: string; wasRemoved: boolean } {
  const { source, result } = withInMemoryScript(scriptSource, (sf) => {
    const dataDecl = sf
      .getVariableDeclarations()
      .find((d) => d.getName() === "data");
    const dataInit = dataDecl?.getInitializer();
    if (
      !dataInit ||
      dataInit.getKind() !== SyntaxKind.ObjectLiteralExpression
    ) {
      return { wasRemoved: false };
    }

    const obj = dataInit.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const navProp = obj.getProperty("navUser");
    if (!navProp || navProp.getKind() !== SyntaxKind.PropertyAssignment) {
      return { wasRemoved: false };
    }

    const init = navProp
      .asKindOrThrow(SyntaxKind.PropertyAssignment)
      .getInitializer();
    if (!init || init.getKind() !== SyntaxKind.ArrayLiteralExpression) {
      return { wasRemoved: false };
    }

    const arr = init.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
    const elements = arr.getElements();
    const index = elements.findIndex((el) => {
      if (el.getKind() !== SyntaxKind.ObjectLiteralExpression) return false;
      const o = el.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
      const titleProp = o.getProperty("title");
      if (!titleProp || titleProp.getKind() !== SyntaxKind.PropertyAssignment) {
        return false;
      }
      const value = titleProp
        .asKindOrThrow(SyntaxKind.PropertyAssignment)
        .getInitializer();
      return (
        value?.getKind() === SyntaxKind.StringLiteral &&
        (value as StringLiteral).getLiteralText() === title
      );
    });

    if (index === -1) return { wasRemoved: false };

    arr.removeElement(index);

    if (iconImportPath) {
      const importDecl = sf
        .getImportDeclarations()
        .find((d) => d.getModuleSpecifierValue() === iconImportPath);
      if (importDecl) {
        const importName = importDecl.getDefaultImport()?.getText();
        const stillUsed =
          importName &&
          sf
            .getDescendantsOfKind(SyntaxKind.Identifier)
            .some(
              (id) =>
                id.getText() === importName &&
                id.getParent()?.getKind() !== SyntaxKind.ImportClause &&
                id.getParent()?.getKind() !== SyntaxKind.ImportSpecifier,
            );
        if (!stillUsed) {
          importDecl.remove();
        }
      }
    }

    sf.formatText();
    return { wasRemoved: true };
  });

  return { source, wasRemoved: result.wasRemoved };
}
