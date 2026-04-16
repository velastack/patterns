import fs from "node:fs";
import { SyntaxKind } from "ts-morph";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";

const NEW_HEADER = `<Sidebar.Header>
		<Sidebar.Menu>
			<TeamSwitcher {teams}>
				{#snippet children()}
					{@const activeTeam = teams.find((t) => t.id === team)}
					{#if activeTeam}
						<Avatar.Root class="size-8 rounded-lg">
							<Avatar.Fallback class="rounded-lg bg-primary text-primary-foreground font-medium">
								{activeTeam.name?.charAt(0).toUpperCase()}
							</Avatar.Fallback>
						</Avatar.Root>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-medium">
								{activeTeam.name}
							</span>
						</div>
					{:else}
						<div
							class="bg-sidebar-accent text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
						>
							<img src="/favicon.svg" alt="logo" class="size-6" />
						</div>
						<div class="grid flex-1 text-left text-sm leading-tight">
							<span class="truncate font-medium">{meta.appName}</span>
						</div>
					{/if}
					<ChevronsUpDownIcon class="ml-auto" />
				{/snippet}
			</TeamSwitcher>
		</Sidebar.Menu>
	</Sidebar.Header>`;

function updateAppSidebarScript(source: string): string {
  const { source: out } = withInMemoryScript(source, (sf) => {
    ensureImports(sf, [
      {
        defaultImport: "TeamSwitcher",
        moduleSpecifier: "$lib/components/team-switcher.svelte",
      },
      {
        defaultImport: "ChevronsUpDownIcon",
        moduleSpecifier: "@lucide/svelte/icons/chevrons-up-down",
      },
      {
        namespaceImport: "Avatar",
        moduleSpecifier: "$lib/components/ui/avatar",
      },
    ]);

    for (const decl of sf.getVariableDeclarations()) {
      const init = decl.getInitializer();
      if (!init || init.getText() !== "$props()") continue;

      const nameNode = decl.getNameNode();
      if (nameNode.getKind() !== SyntaxKind.ObjectBindingPattern) continue;

      const pattern = nameNode.asKindOrThrow(SyntaxKind.ObjectBindingPattern);
      const elements = pattern.getElements();

      if (elements.some((e) => e.getName() === "team")) continue;

      // Type changes first — name change can shift positions and invalidate type node refs.
      const typeNode = decl.getTypeNode();
      if (typeNode?.getKind() === SyntaxKind.IntersectionType) {
        const intersection = typeNode.asKindOrThrow(SyntaxKind.IntersectionType);
        for (const member of intersection.getTypeNodes()) {
          if (member.getKind() !== SyntaxKind.TypeLiteral) continue;
          const lit = member.asKindOrThrow(SyntaxKind.TypeLiteral);
          const propTexts = lit.getProperties().map((p) => p.getText().replace(/[;,]\s*$/, ""));
          if (propTexts.some((t) => /^team\b/.test(t))) break;
          propTexts.push(
            "team?: string | undefined",
            "teams?: { id: string; name: string }[]",
          );
          lit.replaceWithText(`{ ${propTexts.join("; ")}; }`);
          break;
        }
      }

      // Rebuild binding pattern: insert team, teams = [] before first rest/initializer element.
      const elementTexts = elements.map((e) => e.getText());
      let insertIdx = elements.findIndex(
        (e) => e.getDotDotDotToken() || e.getInitializer(),
      );
      if (insertIdx === -1) insertIdx = elements.length;
      elementTexts.splice(insertIdx, 0, "team", "teams = []");
      pattern.replaceWithText(`{ ${elementTexts.join(", ")} }`);
    }
    sf.formatText();
  });
  return out;
}

export function modifyAppSidebar(appSidebarPath: string): boolean {
  if (!fs.existsSync(appSidebarPath)) return false;

  const file = SvelteFile.fromPath(appSidebarPath);
  if (file.hasElement("TeamSwitcher")) return false;
  if (!file.hasElement("Sidebar.Header")) return false;

  file.modifyScript(updateAppSidebarScript);
  file.replaceElement("Sidebar.Header", NEW_HEADER);
  file.writeTo(appSidebarPath);
  return file.hasChanged();
}
