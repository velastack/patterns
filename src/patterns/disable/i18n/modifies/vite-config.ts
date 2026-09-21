import fs from "node:fs";
import { Project, QuoteKind, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  removeImportByModuleSpecifier,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

/** Remove `wuchale()` from the Vite plugins and its import. */
export function unmodifyViteConfig(viteConfigPath: string): ModifyOutcome {
  if (!fs.existsSync(viteConfigPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(viteConfigPath, "utf8");
  if (!original.includes("wuchale")) {
    return { status: "success", changed: false };
  }

  const project = new Project({
    compilerOptions: { allowJs: true },
    manipulationSettings: { quoteKind: QuoteKind.Single },
  });
  const sourceFile = project.addSourceFileAtPath(viteConfigPath);

  // One removal at a time: manipulating the tree invalidates sibling nodes.
  for (;;) {
    let removed = false;
    for (const arr of sourceFile.getDescendantsOfKind(
      SyntaxKind.ArrayLiteralExpression,
    )) {
      const index = arr
        .getElements()
        .findIndex((el) => el.getText().replace(/\s/g, "") === "wuchale()");
      if (index >= 0) {
        arr.removeElement(index);
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }

  removeImportByModuleSpecifier(sourceFile, "wuchale/vite");

  formatLikeSource(sourceFile);
  sourceFile.saveSync();
  return {
    status: "success",
    changed: sourceFile.getFullText() !== original,
  };
}
