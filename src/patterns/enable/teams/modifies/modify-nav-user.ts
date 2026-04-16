import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";

function tryAddNavItemToScriptInner(
  moduleInner: string,
  title: string,
  url: string,
  icon: string,
  iconImportPath: string,
): { newInner: string; wasAdded: boolean } {
  const newNavItemSnippet = `
        {
            title: '${title}',
            url: '${url}',
            icon: ${icon}
        }
    `;

  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sf = project.createSourceFile("module.ts", moduleInner, { overwrite: true });

  const hasIconImport = sf
    .getImportDeclarations()
    .some((d) => d.getModuleSpecifierValue() === iconImportPath);
  if (!hasIconImport) {
    sf.addImportDeclaration({ defaultImport: icon, moduleSpecifier: iconImportPath });
  }

  const dataDecl = sf.getVariableDeclarations().find((d) => d.getName() === "data");
  const dataInit = dataDecl?.getInitializer();
  if (dataInit && dataInit.getKind() === SyntaxKind.ObjectLiteralExpression) {
    const obj = dataInit.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    const navProp = obj.getProperty("navUser");
    if (navProp && navProp.getKind() === SyntaxKind.PropertyAssignment) {
      const pa = navProp.asKindOrThrow(SyntaxKind.PropertyAssignment);
      const init = pa.getInitializer();
      if (init && init.getKind() === SyntaxKind.ArrayLiteralExpression) {
        const arr = init.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);

        const exists = arr.getElements().some((el) => {
          if (el.getKind() !== SyntaxKind.ObjectLiteralExpression) return false;
          const o = el.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
          const titleProp = o.getProperty("title");
          if (!titleProp || titleProp.getKind() !== SyntaxKind.PropertyAssignment) return false;
          const tp = titleProp.asKindOrThrow(SyntaxKind.PropertyAssignment);
          const value = tp.getInitializer();
          return (
            value?.getKind() === SyntaxKind.StringLiteral &&
            (value as import("ts-morph").StringLiteral).getLiteralText() === title
          );
        });

        if (!exists) {
          arr.addElement(newNavItemSnippet.trim());
          sf.formatText();
          return { newInner: sf.getFullText(), wasAdded: true };
        }
      }
    }
  }

  return { newInner: moduleInner, wasAdded: false };
}

export function addItemToNavUser(
  navUserSnippet: string,
  title: string,
  url: string,
  icon: string,
  iconImportPath: string,
): { newNavUserSnippet: string; wasAdded: boolean } {
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(navUserSnippet)) !== null) {
    const attrs = match[1] ?? "";
    const isModule = /\bmodule\b/.test(attrs) || /context\s*=\s*"module"/.test(attrs);
    if (!isModule) {
      continue;
    }

    const moduleOpenTag = `<script${attrs}>`;
    const moduleInner = match[2] ?? "";
    const moduleStart = match.index;
    const moduleEnd = scriptRegex.lastIndex;

    const { newInner, wasAdded } = tryAddNavItemToScriptInner(
      moduleInner,
      title,
      url,
      icon,
      iconImportPath,
    );
    if (wasAdded) {
      return {
        newNavUserSnippet:
          navUserSnippet.slice(0, moduleStart) +
          moduleOpenTag +
          newInner +
          "</script>" +
          navUserSnippet.slice(moduleEnd),
        wasAdded: true,
      };
    }
  }

  scriptRegex.lastIndex = 0;
  while ((match = scriptRegex.exec(navUserSnippet)) !== null) {
    const attrs = match[1] ?? "";
    const isModule = /\bmodule\b/.test(attrs) || /context\s*=\s*"module"/.test(attrs);
    if (isModule) {
      continue;
    }

    const inner = match[2] ?? "";
    if (!inner.includes("navUser")) {
      continue;
    }

    const scriptOpenTag = `<script${attrs}>`;
    const scriptStart = match.index;
    const scriptEnd = scriptRegex.lastIndex;

    const { newInner, wasAdded } = tryAddNavItemToScriptInner(
      inner,
      title,
      url,
      icon,
      iconImportPath,
    );
    if (wasAdded) {
      return {
        newNavUserSnippet:
          navUserSnippet.slice(0, scriptStart) +
          scriptOpenTag +
          newInner +
          "</script>" +
          navUserSnippet.slice(scriptEnd),
        wasAdded: true,
      };
    }
  }

  return { newNavUserSnippet: navUserSnippet, wasAdded: false };
}

export function modifyNavUser(navUserPath: string): boolean {
  if (!fs.existsSync(navUserPath)) {
    return false;
  }

  const navUserSnippet = fs.readFileSync(navUserPath, "utf8");
  const { newNavUserSnippet, wasAdded } = addItemToNavUser(
    navUserSnippet,
    "Teams",
    "/teams",
    "UsersIcon",
    "@lucide/svelte/icons/users",
  );

  if (wasAdded) {
    fs.writeFileSync(navUserPath, newNavUserSnippet, "utf8");
  }

  return wasAdded;
}
