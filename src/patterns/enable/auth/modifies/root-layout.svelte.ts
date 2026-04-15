import fs from "node:fs";
import dedent from "dedent";

export function modifyRootLayoutSvelte(layoutPath: string) {
  let layout = fs.readFileSync(layoutPath, "utf8");
  // TODO: use magic-string to modify the layout

  // find the navbar.root > navbar.list
  const navbarRoot = layout.match(/<Navbar\.Root>([\s\S]*?)<\/Navbar\.Root>/);
  if (!navbarRoot) {
    return;
  }

  const navbarList = navbarRoot[1].match(
    /<Navbar\.List>([\s\S]*?)<\/Navbar\.List>/,
  );
  if (!navbarList) {
    return;
  }

  // add imports
  const imports = dedent`
		import * as AuthMenu from '$lib/components/ui/auth-menu';
		import * as Avatar from '$lib/components/ui/avatar';
	`;

  // Insert imports after the last existing import inside the first <script> block (if any)
  const scriptOpenIdx = layout.indexOf("<script");
  if (scriptOpenIdx !== -1) {
    const scriptOpenEnd = layout.indexOf(">", scriptOpenIdx);
    const scriptCloseIdx =
      scriptOpenEnd !== -1
        ? layout.indexOf("</script>", scriptOpenEnd + 1)
        : -1;
    if (scriptOpenEnd !== -1 && scriptCloseIdx !== -1) {
      const scriptContent = layout.slice(scriptOpenEnd + 1, scriptCloseIdx);
      let lastImportEnd = -1;
      const importRegex = /^\s*import[\s\S]*?;[ \t]*$/gm;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(scriptContent)) !== null) {
        lastImportEnd = match.index + match[0].length;
      }

      if (lastImportEnd !== -1) {
        const before = scriptContent.slice(0, lastImportEnd);
        const after = scriptContent.slice(lastImportEnd);
        const newScriptContent = `${before}\n${imports}\n${after}`;
        layout =
          layout.slice(0, scriptOpenEnd + 1) +
          newScriptContent +
          layout.slice(scriptCloseIdx);
      } else {
        layout = layout.replace("</script>", `${imports}\n</script>`);
      }
    } else {
      layout = layout.replace("</script>", `${imports}\n</script>`);
    }
  } else {
    layout = layout.replace("</script>", `${imports}\n</script>`);
  }

  // add the auth menu to the navbar.list
  const newNavbarList =
    navbarList[1] +
    `
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

  // replace the navbar.list with the new one
  layout = layout.replace(navbarList[1], newNavbarList);

  fs.writeFileSync(layoutPath, layout);
}
