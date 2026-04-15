import fs from "node:fs";
import dedent from "dedent";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";

function ensureNamedImport(
  sourceFile: import("ts-morph").SourceFile,
  moduleSpecifier: string,
  name: string,
) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (existing) {
    const has = existing.getNamedImports().some((ni) => ni.getName() === name);
    if (!has) existing.addNamedImport(name);
    return;
  }
  sourceFile.addImportDeclaration({ namedImports: [name], moduleSpecifier });
}

function ensureNamespaceImport(
  sourceFile: import("ts-morph").SourceFile,
  moduleSpecifier: string,
  ns: string,
) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === moduleSpecifier);
  if (existing) return;
  sourceFile.addImportDeclaration({ namespaceImport: ns, moduleSpecifier });
}

export function modifyHooksServerI18n(hooksServerPath: string) {
  if (!fs.existsSync(hooksServerPath)) return false;

  const original = fs.readFileSync(hooksServerPath, "utf8");
  if (original.includes("runWithLocale") || original.includes("loadLocales(")) {
    return false;
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksServerPath);

  const handleDecl = sourceFile.getVariableDeclaration("handle");
  if (!handleDecl) return false;

  const handleStmt = handleDecl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
  if (!handleStmt?.hasExportKeyword()) {
    return false;
  }

  ensureNamedImport(sourceFile, "@sveltejs/kit/hooks", "sequence");
  ensureNamedImport(sourceFile, "wuchale/load-utils/server", "runWithLocale");
  ensureNamedImport(sourceFile, "wuchale/load-utils/server", "loadLocales");
  ensureNamedImport(sourceFile, "$locales/main.url", "getLocale");
  ensureNamedImport(sourceFile, "$locales/data", "locales");
  ensureNamespaceImport(sourceFile, "$locales/main.loader.server.svelte.js", "main");
  ensureNamespaceImport(sourceFile, "$locales/js.loader.server.js", "js");

  const statements = sourceFile.getStatements();
  const handleStmtIndex = statements.findIndex((s) => s === handleStmt);
  const i18nHandleName = "handleWuchale";

  const startupSnippet = dedent`
    loadLocales(main.key, main.loadIDs, main.loadCatalog, locales);
    loadLocales(js.key, js.loadIDs, js.loadCatalog, locales);
  `;

  const i18nHandleSnippet = dedent`
    const ${i18nHandleName} = async ({ event, resolve }: any) => {
      const locale = getLocale(event.url);
      return await runWithLocale(locale, () =>
        resolve(event, {
          transformPageChunk: ({ html }: { html: string }) =>
            html.replace('%sveltekit.lang%', locale)
        })
      );
    };
  `;

  if (handleStmtIndex >= 0) {
    sourceFile.insertStatements(
      handleStmtIndex,
      `\n${startupSnippet}\n\n${i18nHandleSnippet}\n`,
    );
  } else {
    sourceFile.addStatements(`\n${startupSnippet}\n\n${i18nHandleSnippet}\n`);
  }

  const init = handleDecl.getInitializer();
  if (!init) return false;

  const initText = init.getText();
  if (initText.includes(i18nHandleName) || initText.includes("runWithLocale")) {
    return false;
  }

  handleDecl.setInitializer(`sequence(${i18nHandleName}, ${initText})`);
  sourceFile.formatText();
  sourceFile.saveSync();
  return true;
}
