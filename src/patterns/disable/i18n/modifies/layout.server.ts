import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";
import { LAYOUT_SERVER_SNIPPET } from "../../../enable/i18n/modifies/layout.server";
import { Node, SyntaxKind } from "ts-morph";
import { findLoadFunction } from "../../../../runtime/load-function";
import {
  removeUnusedBindingElement,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";

const normalize = (source: string) =>
  source.replace(/["']/g, "'").replace(/\s+/g, "");

/** The comment enable-i18n put above the property, on its own lines. */
const LOCALE_COMMENT =
  /^[ \t]*\/\/ Decided on the server \(src\/hooks\.server\.ts\), because pages without a\r?\n[ \t]*\/\/ language in their URL follow the visitor's preference\.\r?\n/m;

const FAILURE_HINT =
  "src/routes/+layout.server.ts still returns `locale: locals.locale`. Remove it from the load.";

/**
 * Undo `modifyLayoutServerLocale`: the root layout's server load stops
 * returning `locale`. A file enable-i18n wrote whole comes out empty, for the
 * caller to delete.
 */
export function unmodifyLayoutServerLocale(
  layoutServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutServerPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(layoutServerPath, "utf8");
  if (!original.includes("locals.locale")) {
    return { status: "success", changed: false };
  }

  if (normalize(original) === normalize(LAYOUT_SERVER_SNIPPET)) {
    fs.writeFileSync(layoutServerPath, "", "utf8");
    return { status: "success", changed: true };
  }

  // The comment first: left above a removed property it would attach itself
  // to whatever follows.
  const { source } = withInMemoryScript(
    original.replace(LOCALE_COMMENT, ""),
    (sf) => {
      const load = findLoadFunction(sf);
      const properties = (load ?? sf)
        .getDescendantsOfKind(SyntaxKind.PropertyAssignment)
        .filter(
          (property) =>
            property.getName() === "locale" &&
            /(^|\.)locals\.locale$/.test(
              property.getInitializer()?.getText() ?? "",
            ),
        );
      for (const property of properties) {
        const object = property.getParent();
        property.remove();
        // `return {}` reads worse on three lines than on one.
        if (
          Node.isObjectLiteralExpression(object) &&
          object.getProperties().length === 0
        ) {
          object.replaceWithText("{}");
        }
      }
      removeUnusedBindingElement(sf, "locals");
    },
  );
  if (source === original) {
    return { status: "failed", message: FAILURE_HINT };
  }
  fs.writeFileSync(layoutServerPath, source, "utf8");
  return { status: "success", changed: source !== original };
}
