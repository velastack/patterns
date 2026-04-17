import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

const AUTH_MENU_NAVBAR_ITEM = `
		<Navbar.Item
			class="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4"
		>
			<AuthMenu.Root>
				{#snippet user()}
					<AuthMenu.Trigger>
						<Avatar.Root>
							{#if data.user?.avatar}
								<Avatar.Image
									src="/api/files/users/{data.user?.id}/{data.user?.avatar}"
									alt={data.user?.email}
								/>
							{/if}
							<Avatar.Fallback>
								{data.user?.email?.charAt(0).toUpperCase()}
							</Avatar.Fallback>
						</Avatar.Root>
					</AuthMenu.Trigger>

					<AuthMenu.Content align="end">
						<AuthMenu.Item href="/dashboard">Dashboard</AuthMenu.Item>
						<AuthMenu.Group>
							<AuthMenu.Item href="/settings">Settings</AuthMenu.Item>
							<AuthMenu.Item>
								<form action="/logout" method="post">
									<button type="submit" class="contents">Logout</button>
								</form>
							</AuthMenu.Item>
						</AuthMenu.Group>
					</AuthMenu.Content>
				{/snippet}

				{#snippet guest()}
					<Button
						class="w-full justify-start md:justify-center md:w-auto"
						variant="ghost"
						href="/login">Login</Button
					>
					<Button
						class="w-full justify-start md:justify-center md:w-auto"
						variant="outline"
						href="/signup">Sign up</Button
					>
				{/snippet}
			</AuthMenu.Root>
		</Navbar.Item>
	`;

const IMPORT_SNIPPET = dedent`
  import * as AuthMenu from '$lib/components/ui/auth-menu';
  import * as Avatar from '$lib/components/ui/avatar';
`;

const FAILURE_HINT = [
  "Add the auth menu inside your <Navbar.List> in the root layout.",
  "",
  "Imports to add to the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup to add inside <Navbar.List>:",
  AUTH_MENU_NAVBAR_ITEM,
].join("\n");

const NOT_FOUND_HINT = [
  "Create a root layout that includes an auth menu inside <Navbar.List>.",
  "",
  "Imports for the <script> tag:",
  "",
  IMPORT_SNIPPET,
  "",
  "Markup inside <Navbar.List>:",
  AUTH_MENU_NAVBAR_ITEM,
].join("\n");

export function modifyRootLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.hasElement("Navbar.List")) {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (file.hasElement("AuthMenu.Root")) {
    return { status: "success", changed: false };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        {
          namespaceImport: "AuthMenu",
          moduleSpecifier: "$lib/components/ui/auth-menu",
        },
        {
          namespaceImport: "Avatar",
          moduleSpecifier: "$lib/components/ui/avatar",
        },
      ]);
    });
    return out;
  });

  file.insertBeforeClosingTag("Navbar.List", AUTH_MENU_NAVBAR_ITEM);
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
