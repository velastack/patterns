import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import type { ModifyOutcome } from "../../../../core/types";

const BLOG_NAVBAR_ITEM = `
		<Navbar.Item>
			<Button class="w-full justify-start md:justify-center md:w-auto" href="/blog" variant="ghost">
				Blog
			</Button>
		</Navbar.Item>
	`;

const FAILURE_HINT = dedent`
  Add a Blog link inside <Navbar.List> in the public root layout:

  <Navbar.Item>
    <Button class="w-full justify-start md:justify-center md:w-auto" href="/blog" variant="ghost">
      Blog
    </Button>
  </Navbar.Item>
`;

const NOT_FOUND_HINT = dedent`
  Create a public root layout with a Blog link in its Navbar.List:

  <Navbar.Item>
    <Button class="w-full justify-start md:justify-center md:w-auto" href="/blog" variant="ghost">
      Blog
    </Button>
  </Navbar.Item>
`;

export function modifyPublicRootLayout(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.hasElement("Navbar.List")) {
    return { status: "failed", message: FAILURE_HINT };
  }

  const raw = fs.readFileSync(layoutPath, "utf8");
  if (/href=["']\/blog["']/.test(raw)) {
    return { status: "success", changed: false };
  }

  file.insertBeforeClosingTag("Navbar.List", BLOG_NAVBAR_ITEM);
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
