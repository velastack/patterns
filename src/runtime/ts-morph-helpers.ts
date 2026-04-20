import {
  Project,
  QuoteKind,
  SyntaxKind,
  type ImportDeclarationStructure,
  type OptionalKind,
  type SourceFile,
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

/** Remove a top-level function or variable declaration by name, if present. */
export function removeTopLevelStatementByIdentifier(
  sf: SourceFile,
  name: string,
): { wasRemoved: boolean } {
  const fn = sf.getFunction(name);
  if (fn) {
    fn.remove();
    return { wasRemoved: true };
  }
  const vs = sf
    .getVariableStatements()
    .find((s) => s.getDeclarations().some((d) => d.getName() === name));
  if (vs) {
    vs.remove();
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
      const remainingRefs = arr.getElements().some((el) => {
        if (el.getKind() !== SyntaxKind.ObjectLiteralExpression) return false;
        const o = el.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
        const iconProp = o.getProperty("icon");
        if (!iconProp || iconProp.getKind() !== SyntaxKind.PropertyAssignment) {
          return false;
        }
        return iconProp
          .asKindOrThrow(SyntaxKind.PropertyAssignment)
          .getInitializer()
          ?.getText() !== undefined;
      });
      const importDecl = sf
        .getImportDeclarations()
        .find((d) => d.getModuleSpecifierValue() === iconImportPath);
      if (importDecl && !remainingRefs) {
        const importName = importDecl.getDefaultImport()?.getText();
        const stillUsed =
          importName &&
          sf
            .getDescendantsOfKind(SyntaxKind.Identifier)
            .some(
              (id) =>
                id.getText() === importName &&
                id.getParent()?.getKind() !==
                  SyntaxKind.ImportClause &&
                id.getParent()?.getKind() !==
                  SyntaxKind.ImportSpecifier,
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
