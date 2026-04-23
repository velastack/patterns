import fs from "node:fs";
import { SyntaxKind } from "ts-morph";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { withInMemoryScript } from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

function updateScript(source: string): string {
  const { source: out } = withInMemoryScript(source, (sf) => {
    for (const decl of sf.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (!init || init.getText() !== "$props()") continue;

      const nameNode = decl.getNameNode();
      if (nameNode.getKind() !== SyntaxKind.ObjectBindingPattern) continue;
      const pattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
      const elements = pattern.getElements();
      const hasSub = elements.some((e) => e.getName() === "subscription");

      // Strip subscription from the props type literal (the specific type
      // added by enable-subscriptions — leave unrelated `subscription` props
      // alone).
      const typeNode = decl.getTypeNode();
      if (typeNode?.getKind() === SyntaxKind.IntersectionType) {
        const intersection = typeNode.asKindOrThrow(
          SyntaxKind.IntersectionType,
        );
        for (const member of intersection.getTypeNodes()) {
          if (member.getKind() !== SyntaxKind.TypeLiteral) continue;
          const lit = member.asKindOrThrow(SyntaxKind.TypeLiteral);
          const propTexts = lit
            .getProperties()
            .map((p) => p.getText().replace(/[;,]\s*$/, ""))
            .filter((t) => !/^\s*subscription\??\s*:/.test(t));
          lit.replaceWithText(
            propTexts.length ? `{ ${propTexts.join("; ")}; }` : "{}",
          );
          break;
        }
      }

      if (hasSub) {
        const remaining = elements
          .filter((e) => e.getName() !== "subscription")
          .map((e) => e.getText());
        pattern.replaceWithText(`{ ${remaining.join(", ")} }`);
      }
    }
    sf.formatText();
  });
  return out;
}

export function unmodifyAppSidebar(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }

  const source = fs.readFileSync(filePath, "utf8");
  const hasSubPropType = /subscription\??\s*:\s*\{/.test(source);
  const hasSubProp = /\bsubscription\s*=\s*null\b/.test(source);

  const file = new SvelteFile(source);
  const hasNavUserSubAttr =
    file.hasElement("NavUser") && file.hasAttribute("NavUser", "subscription");

  if (!hasSubPropType && !hasSubProp && !hasNavUserSubAttr) {
    return { status: "success", changed: false };
  }

  if (hasSubPropType || hasSubProp) {
    file.modifyScript(updateScript);
  }
  if (hasNavUserSubAttr) {
    file.removeAttribute("NavUser", "subscription");
  }

  file.writeTo(filePath);
  return { status: "success", changed: file.hasChanged() };
}
