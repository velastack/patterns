import fs from "node:fs";
import { SyntaxKind } from "ts-morph";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  withInMemoryScript,
  formatLikeSource,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

/** The header enable-auth ships, which the team switcher replaced. */
const ORIGINAL_HEADER = `<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg">
					{#snippet child({ props })}
						<a href="/dashboard" {...props}>
							<div
								class="bg-sidebar-accent text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
							>
								<img src={favicon} alt="logo" class="size-6" />
							</div>
							<div class="grid flex-1 text-left text-sm leading-tight">
								<span class="truncate font-medium">{site.name}</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>`;

/**
 * A sidebar from before `$lib/site` names the app with a `meta` prop; the
 * header goes back to whichever the team switcher's fallback used.
 */
const LEGACY_NAME = "{meta.appName}";

/** Imports enable-teams added, dropped once the markup no longer uses them. */
const TEAM_IMPORTS: [name: string, moduleSpecifier: string][] = [
  ["TeamSwitcher", "$lib/components/team-switcher.svelte"],
  ["ChevronsUpDownIcon", "@lucide/svelte/icons/chevrons-up-down"],
  ["Avatar", "$lib/components/ui/avatar"],
];

const TEAM_PROPS = ["team", "teams"];

function markupOf(source: string): string {
  return source.replace(/<script[\s\S]*?<\/script>/g, "");
}

function revertAppSidebarScript(source: string, markup: string): string {
  const { source: out } = withInMemoryScript(source, (sf) => {
    for (const decl of sf.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (!init || init.getText() !== "$props()") continue;

      const nameNode = decl.getNameNode();
      if (nameNode.getKind() !== SyntaxKind.ObjectBindingPattern) continue;

      // Type first: rewriting the binding pattern shifts what follows.
      const typeNode = decl.getTypeNode();
      if (typeNode?.getKind() === SyntaxKind.IntersectionType) {
        for (const member of typeNode
          .asKindOrThrow(SyntaxKind.IntersectionType)
          .getTypeNodes()) {
          if (member.getKind() !== SyntaxKind.TypeLiteral) continue;
          const literal = member.asKindOrThrow(SyntaxKind.TypeLiteral);
          const before = literal.getProperties().length;
          for (const name of TEAM_PROPS) {
            literal.getProperty(name)?.remove();
          }
          if (literal.getProperties().length !== before) {
            // Collapse to one line, as enable-auth writes it; prettier keeps
            // whichever shape it finds.
            const remaining = literal
              .getProperties()
              .map((p) => p.getText().replace(/[;,]\s*$/, ""));
            literal.replaceWithText(`{ ${remaining.join("; ")} }`);
          }
        }
      }

      const pattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
      const elements = pattern.getElements();
      const kept = elements
        .filter((el) => !TEAM_PROPS.includes(el.getName()))
        .map((el) => el.getText());
      if (kept.length !== elements.length) {
        pattern.replaceWithText(`{ ${kept.join(", ")} }`);
      }
    }

    for (const [name, moduleSpecifier] of TEAM_IMPORTS) {
      if (!new RegExp(`\\b${name}\\b`).test(markup)) {
        removeImportByModuleSpecifier(sf, moduleSpecifier);
      }
    }
    formatLikeSource(sf);
    ensureBlankLineAfterImports(sf);
  });
  return out;
}

/** Put the plain app-name header back in place of the team switcher. */
export function unmodifyAppSidebar(appSidebarPath: string): ModifyOutcome {
  if (!fs.existsSync(appSidebarPath)) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(appSidebarPath);
  if (!file.hasElement("TeamSwitcher")) {
    return { status: "success", changed: false };
  }

  file.replaceElement(
    "Sidebar.Header",
    file.toString().includes(LEGACY_NAME)
      ? ORIGINAL_HEADER.replace("{site.name}", LEGACY_NAME)
      : ORIGINAL_HEADER,
  );
  const markup = markupOf(file.toString());
  file.modifyScript((source) => revertAppSidebarScript(source, markup));
  file.writeTo(appSidebarPath);
  return { status: "success", changed: file.hasChanged() };
}
