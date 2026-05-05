import fs from "node:fs";
import { SyntaxKind } from "ts-morph";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { withInMemoryScript } from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const SUBSCRIPTION_TYPE = "{ id: string; productName: string | null } | null";

const FAILURE_HINT = [
  "Update src/lib/components/app-sidebar.svelte to forward a subscription prop:",
  "",
  "1. Add `subscription = null` to the destructured $props() call.",
  `2. Add \`subscription?: ${SUBSCRIPTION_TYPE}\` to the props type.`,
  "3. Pass `{subscription}` to <NavUser>.",
].join("\n");

const NOT_FOUND_HINT = [
  "Create src/lib/components/app-sidebar.svelte before enabling subscriptions.",
].join("\n");

function updateScript(source: string): {
  source: string;
  wasAdded: boolean;
} {
  let wasAdded = false;
  const { source: out } = withInMemoryScript(source, (sf) => {
    for (const decl of sf.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (!init || init.getText() !== "$props()") continue;

      const nameNode = decl.getNameNode();
      if (nameNode.getKind() !== SyntaxKind.ObjectBindingPattern) continue;
      const pattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
      const elements = pattern.getElements();
      if (elements.some((e) => e.getName() === "subscription")) {
        // Already has subscription prop — no-op.
        return;
      }

      // Insert subscription?: ... into the props type literal if present.
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
            .map((p) => p.getText().replace(/[;,]\s*$/, ""));
          if (propTexts.some((t) => /^\s*subscription\??\s*:/.test(t))) {
            continue;
          }
          propTexts.push(`subscription?: ${SUBSCRIPTION_TYPE}`);
          lit.replaceWithText(`{ ${propTexts.join("; ")}; }`);
          break;
        }
      }

      // Insert `subscription = null` before the first rest/default-only element.
      const elementTexts = elements.map((e) => e.getText());
      let insertIdx = elements.findIndex(
        (e) => e.getDotDotDotToken() || e.getInitializer(),
      );
      if (insertIdx === -1) insertIdx = elementTexts.length;
      elementTexts.splice(insertIdx, 0, "subscription = null");
      pattern.replaceWithText(`{ ${elementTexts.join(", ")} }`);
      wasAdded = true;
    }
    sf.formatText();
  });
  return { source: out, wasAdded };
}

export function modifyAppSidebar(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(filePath, "utf8");
  if (
    original.includes("subscription?: {") ||
    original.includes("subscription={subscription}") ||
    original.includes("{subscription}")
  ) {
    return { status: "success", changed: false };
  }

  const file = new SvelteFile(original);
  if (!file.hasElement("NavUser")) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const scriptChanged = file.modifyScript((src) => updateScript(src).source);

  const templateChanged = !file.hasAttribute("NavUser", "subscription")
    ? file.appendToAttributes("NavUser", " {subscription}")
    : false;

  if (!scriptChanged && !templateChanged) {
    return { status: "failed", message: FAILURE_HINT };
  }

  file.writeTo(filePath);
  return { status: "success", changed: file.hasChanged() };
}
