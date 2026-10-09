import fs from "node:fs";
import { SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { withInMemoryScript } from "../../../../runtime/ts-morph-helpers";
import {
  bindingText,
  propsStatement,
} from "../../../enable/subscriptions/modifies/modify-nav-user";

/**
 * Takes the plan label out of nav-user: the lines showing it, `planLabel`
 * and the `subscription` prop. What other patterns added stays.
 */
export function unmodifyNavUser(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(filePath, "utf8");
  if (!original.includes("planLabel")) {
    return { status: "success", changed: false };
  }

  const file = new SvelteFile(original);
  file.modifyScript(
    (content) =>
      withInMemoryScript(
        // With the blank line enable-subscriptions put before it.
        content.replace(
          /\n[ \t]*\n[ \t]*const planLabel = \$derived\([^\n]*\);/,
          "",
        ),
        (sf) => {
          const decl = propsStatement(sf)?.getDeclarations()[0];
          const binding = decl
            ?.getNameNode()
            .asKind(SyntaxKind.ObjectBindingPattern);
          const kept = binding
            ?.getElements()
            .filter((e) => e.getName() !== "subscription")
            .map((e) => e.getText());
          if (binding && kept) {
            binding.replaceWithText(bindingText(binding.getText(), kept));
          }
          decl
            ?.getTypeNode()
            ?.asKind(SyntaxKind.TypeLiteral)
            ?.getProperty("subscription")
            ?.remove();
        },
      ).source,
  );

  // The lines under the name, with the line break before them.
  const out = file
    .toString()
    .replace(/\n[ \t]*<span class="[^"]*">\s*\{planLabel\}\s*<\/span>/g, "");

  fs.writeFileSync(filePath, out, "utf8");
  return { status: "success", changed: out !== original };
}
