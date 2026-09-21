import fs from "node:fs";
import { Project, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import {
  removeUnusedBindingElement,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";

export function unmodifyLayoutServer(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const originalSource = fs.readFileSync(layoutPath, "utf8");
  if (!originalSource.includes("locals.pb.authStore.record")) {
    return { status: "success", changed: false };
  }

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(layoutPath);

  const literals = sourceFile.getDescendantsOfKind(
    SyntaxKind.ObjectLiteralExpression,
  );
  for (const obj of literals) {
    const userProp = obj.getProperty("user");
    if (!userProp || userProp.getKind() !== SyntaxKind.PropertyAssignment) {
      continue;
    }
    const value = (userProp as import("ts-morph").PropertyAssignment)
      .getInitializer()
      ?.getText();
    if (value === "locals.pb.authStore.record") {
      userProp.remove();
    }
  }
  // `user` was often the layout's only use of `locals`, which enable-auth
  // destructured for it.
  removeUnusedBindingElement(sourceFile, "locals");

  formatLikeSource(sourceFile);
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
