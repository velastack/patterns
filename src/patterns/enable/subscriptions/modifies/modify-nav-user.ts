import fs from "node:fs";
import { SyntaxKind, type SourceFile, type VariableStatement } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { withInMemoryScript } from "../../../../runtime/ts-morph-helpers";

const NOT_FOUND_HINT = [
  "src/lib/components/nav-user.svelte is missing.",
  "Enable auth and payments first; subscriptions layers a plan label on top of the existing nav-user.",
].join("\n");

const FAILURE_HINT = [
  "Could not find the props and the name lines in nav-user.svelte. Show the plan by hand:",
  "",
  "let { user, subscription = null }: { ...; subscription?: { id: string; productName: string | null } | null } = $props();",
  "const planLabel = $derived(subscription?.productName ?? 'Free');",
  "",
  "<!-- Under the name, in the trigger and in the dropdown label: -->",
  '<span class="truncate text-xs text-muted-foreground">{planLabel}</span>',
].join("\n");

const SUBSCRIPTION_TYPE = "{ id: string; productName: string | null } | null";
const PLAN_LABEL =
  "const planLabel = $derived(subscription?.productName ?? 'Free');";

/** The line under the name: muted in the trigger, plain in the dropdown label. */
const PLAN_LINES = [
  '<span class="truncate text-xs text-muted-foreground">{planLabel}</span>',
  '<span class="truncate text-xs">{planLabel}</span>',
];

/** `let { ... }: { ... } = $props();` */
export function propsStatement(sf: SourceFile): VariableStatement | undefined {
  return sf
    .getVariableStatements()
    .find((s) =>
      s
        .getDeclarations()
        .some(
          (d) =>
            d.getInitializer()?.getText() === "$props()" &&
            d.getNameNode().getKind() === SyntaxKind.ObjectBindingPattern,
        ),
    );
}

/** `{ a, b }` with `texts` as its elements, one per line if it was. */
export function bindingText(current: string, texts: string[]): string {
  if (!current.includes("\n")) return `{ ${texts.join(", ")} }`;
  const indent = current.match(/\n([ \t]+)\S/)?.[1] ?? "\t";
  const close = current.match(/\n([ \t]*)\}$/)?.[1] ?? "";
  return `{\n${texts.map((t) => indent + t).join(",\n")}\n${close}}`;
}

function addSubscriptionProp(sf: SourceFile): boolean {
  const statement = propsStatement(sf);
  const decl = statement?.getDeclarations()[0];
  const binding = decl?.getNameNode().asKind(SyntaxKind.ObjectBindingPattern);
  const type = decl?.getTypeNode()?.asKind(SyntaxKind.TypeLiteral);
  if (!statement || !decl || !binding || !type) return false;

  if (!binding.getElements().some((e) => e.getName() === "subscription")) {
    const texts = binding.getElements().map((e) => e.getText());
    const rest = binding.getElements().findIndex((e) => e.getDotDotDotToken());
    texts.splice(rest === -1 ? texts.length : rest, 0, "subscription = null");
    binding.replaceWithText(bindingText(binding.getText(), texts));
  }
  if (!type.getProperty("subscription")) {
    type.addProperty({
      name: "subscription",
      hasQuestionToken: true,
      type: SUBSCRIPTION_TYPE,
    });
  }
  sf.insertStatements(sf.getStatements().indexOf(statement) + 1, (writer) =>
    writer.blankLine().write(PLAN_LABEL),
  );
  return true;
}

/**
 * Shows the user's plan under their name in nav-user: a `subscription` prop
 * (the (app) layout passes it), `planLabel` from it, and a line under each
 * name. Edits the file rather than replacing it, so the items other patterns
 * added to the menu (teams, API keys) stay.
 */
export function modifyNavUser(filePath: string): ModifyOutcome {
  if (!fs.existsSync(filePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes("planLabel")) {
    return { status: "success", changed: false };
  }

  const file = new SvelteFile(original);
  let added = false;
  file.modifyScript(
    (content) =>
      withInMemoryScript(content, (sf) => {
        added = addSubscriptionProp(sf);
      }).source,
  );
  if (!added) return { status: "failed", message: FAILURE_HINT };

  // The name lines, in the markup after the script.
  const source = file.toString();
  const markupStart = source.indexOf("</script>");
  const names = [
    ...source
      .slice(markupStart)
      .matchAll(
        /^([ \t]*)<span class="truncate font-medium">[\s\S]*?<\/span>/gm,
      ),
  ];
  if (names.length < 2) return { status: "failed", message: FAILURE_HINT };

  let out = source;
  // From the last, so the earlier offsets stay put.
  for (const [i, match] of [...names.slice(0, 2).entries()].reverse()) {
    const end = markupStart + match.index! + match[0].length;
    out = `${out.slice(0, end)}\n${match[1]}${PLAN_LINES[i]}${out.slice(end)}`;
  }

  fs.writeFileSync(filePath, out, "utf8");
  return { status: "success", changed: true };
}
