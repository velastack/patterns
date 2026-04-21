import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import {
  Project,
  QuoteKind,
  SyntaxKind,
  type SourceFile,
} from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const NEGOTIATE_ONLY_SNIPPET = dedent`
  import { reroute as negotiateReroute } from '$lib/negotiate';

  export const reroute = ({ url }) => negotiateReroute(url.pathname);
`;

const FAILURE_HINT = dedent`
  Compose your existing reroute in src/hooks.ts with the negotiation reroute:

  import { reroute as negotiateReroute } from '$lib/negotiate';

  export const reroute = ({ url }) => existingReroute(negotiateReroute(url.pathname));
`;

function ensureNegotiateImport(sourceFile: SourceFile) {
  const existing = sourceFile
    .getImportDeclarations()
    .find((d) => d.getModuleSpecifierValue() === "$lib/negotiate");
  if (existing) {
    const has = existing.getNamedImports().some((ni) => {
      return (
        ni.getName() === "reroute" &&
        ni.getAliasNode()?.getText() === "negotiateReroute"
      );
    });
    if (!has) {
      existing.addNamedImport({ name: "reroute", alias: "negotiateReroute" });
    }
    return;
  }
  sourceFile.addImportDeclaration({
    namedImports: [{ name: "reroute", alias: "negotiateReroute" }],
    moduleSpecifier: "$lib/negotiate",
  });
}

export function modifyHooksNegotiate(hooksPath: string): ModifyOutcome {
  if (!fs.existsSync(hooksPath)) {
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(hooksPath, NEGOTIATE_ONLY_SNIPPET + "\n");
    return { status: "success", changed: true };
  }

  const original = fs.readFileSync(hooksPath, "utf8");
  if (original.includes("negotiateReroute")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksPath);

  const rerouteDecl = sourceFile.getVariableDeclaration("reroute");

  if (!rerouteDecl) {
    ensureNegotiateImport(sourceFile);
    sourceFile.addStatements(
      `\nexport const reroute = ({ url }) => negotiateReroute(url.pathname);\n`,
    );
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  const rerouteStmt = rerouteDecl.getFirstAncestorByKind(
    SyntaxKind.VariableStatement,
  );
  if (!rerouteStmt?.hasExportKeyword()) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const init = rerouteDecl.getInitializer();
  if (!init) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const hasI18nHelper = sourceFile
    .getVariableDeclarations()
    .some((d) => d.getName() === "rerouteDeLocalize");
  const initText = init.getText();

  if (hasI18nHelper && initText.includes("rerouteDeLocalize")) {
    ensureNegotiateImport(sourceFile);
    rerouteDecl.setInitializer(
      "({ url }) => rerouteDeLocalize(negotiateReroute(url.pathname))",
    );
    sourceFile.formatText();
    sourceFile.saveSync();
    return { status: "success", changed: true };
  }

  return { status: "failed", message: FAILURE_HINT };
}
