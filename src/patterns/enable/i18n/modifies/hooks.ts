import fs from "node:fs";
import path from "node:path";
import dedent from "dedent";
import { Project, QuoteKind, SyntaxKind, type SourceFile } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  ensureNamedImport,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

const DELOCALIZE_HELPER = dedent`
  const rerouteDeLocalize = (url: string) => {
    const [upath, locale] = deLocalizeDefault(url, locales);
    const { path } = matchUrl(upath, locale);
    return path ?? url;
  };
`;

/**
 * The whole file, for a project that had no universal hooks. `disable-i18n`
 * deletes it again once the de-localizing reroute is all that is left.
 */
export const HOOKS_SNIPPET = dedent`
  import { deLocalizeDefault } from 'wuchale/url';
  import { matchUrl } from '$locales/main.url';
  import { locales } from '$locales/data';

  const rerouteDeLocalize = (url: string) => {
    const [upath, locale] = deLocalizeDefault(url, locales);
    const { path } = matchUrl(upath, locale);
    return path ?? url;
  };

  export const reroute = ({ url }) => rerouteDeLocalize(url.pathname);
`;

const FAILURE_HINT = dedent`
  Compose your existing reroute in src/hooks.ts with the wuchale de-localizer:

  import { deLocalizeDefault } from 'wuchale/url';
  import { matchUrl } from '$locales/main.url';
  import { locales } from '$locales/data';

  const rerouteDeLocalize = (url: string) => {
    const [upath, locale] = deLocalizeDefault(url, locales);
    const { path } = matchUrl(upath, locale);
    return path ?? url;
  };

  export const reroute = ({ url }) => rerouteDeLocalize(existingReroute(url.pathname));
`;

/** What `enable-content-negotiation` leaves behind, to the whitespace. */
const NEGOTIATE_ONLY_REROUTE =
  /^\(\s*\{\s*url\s*\}\s*\)\s*=>\s*negotiateReroute\(\s*url\.pathname\s*\)$/;

/** A `reroute` this modifier cannot compose with: not a variable declaration. */
function hasOtherReroute(sourceFile: SourceFile): boolean {
  if (sourceFile.getFunction("reroute")) return true;
  return sourceFile
    .getExportDeclarations()
    .some((d) =>
      d
        .getNamedExports()
        .some(
          (n) => (n.getAliasNode()?.getText() ?? n.getName()) === "reroute",
        ),
    );
}

function ensureDeLocalizeImports(sourceFile: SourceFile) {
  ensureNamedImport(sourceFile, "wuchale/url", "deLocalizeDefault");
  ensureNamedImport(sourceFile, "$locales/main.url", "matchUrl");
  ensureNamedImport(sourceFile, "$locales/data", "locales");
}

/**
 * Add the de-localizing reroute to `src/hooks.ts`, composing with the one
 * `enable-content-negotiation` wrote rather than replacing the file: either
 * pattern may be enabled first, and negotiation's `modifyHooksNegotiate`
 * composes the other way round.
 */
export function modifyHooksI18n(hooksPath: string): ModifyOutcome {
  if (!fs.existsSync(hooksPath)) {
    fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
    fs.writeFileSync(hooksPath, HOOKS_SNIPPET + "\n");
    return { status: "success", changed: true };
  }

  const original = fs.readFileSync(hooksPath, "utf8");
  if (original.includes("rerouteDeLocalize")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(hooksPath);

  const rerouteDecl = sourceFile.getVariableDeclaration("reroute");

  if (!rerouteDecl) {
    // A reroute in a shape ts-morph cannot rewrite (a function declaration,
    // a re-export) would collide with the one added below.
    if (hasOtherReroute(sourceFile)) {
      return { status: "failed", message: FAILURE_HINT };
    }
    ensureDeLocalizeImports(sourceFile);
    sourceFile.addStatements(
      `\n${DELOCALIZE_HELPER}\n\nexport const reroute = ({ url }) => rerouteDeLocalize(url.pathname);\n`,
    );
    formatLikeSource(sourceFile);
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
  if (!init || !NEGOTIATE_ONLY_REROUTE.test(init.getText())) {
    return { status: "failed", message: FAILURE_HINT };
  }

  ensureDeLocalizeImports(sourceFile);
  rerouteDecl.setInitializer(
    "({ url }) => rerouteDeLocalize(negotiateReroute(url.pathname))",
  );

  // Last: inserting text forgets the nodes above, and the helper has to be
  // declared before the reroute that reads it.
  const target = sourceFile
    .getVariableStatements()
    .find((s) => s.getDeclarations().some((d) => d.getName() === "reroute"))!;
  sourceFile.insertText(target.getStart(true), `${DELOCALIZE_HELPER}\n\n`);

  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
