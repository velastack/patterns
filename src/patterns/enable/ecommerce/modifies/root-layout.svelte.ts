import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureImports,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

export const CART_BUTTON_MODULE = "#lib/components/cart/cart-button.svelte";

const CART_NAVBAR_ITEM = "<Navbar.Item>\n\t<CartButton />\n</Navbar.Item>";

const IMPORT_SNIPPET = `import CartButton from '${CART_BUTTON_MODULE}';`;

const FAILURE_HINT = dedent`
  Add the cart button inside your <Navbar.List> in the root layout.

  Import to add to the <script> tag:

  ${IMPORT_SNIPPET}

  Markup to add inside <Navbar.List>:

  ${CART_NAVBAR_ITEM}
`;

const NOT_FOUND_HINT = dedent`
  Add the cart button to the layout your public pages share.

  Import for the <script> tag:

  ${IMPORT_SNIPPET}

  Markup, wherever your navigation is:

  <CartButton />
`;

/**
 * Puts the cart button in the navbar: left of the account menu when auth
 * added one, else after the last item.
 */
export function modifyRootLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.hasElement("Navbar.List")) {
    return { status: "failed", message: FAILURE_HINT };
  }
  if (file.hasElement("CartButton")) {
    return { status: "success", changed: false };
  }

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        { defaultImport: "CartButton", moduleSpecifier: CART_BUTTON_MODULE },
      ]);
    });
    return out;
  });

  const authItem = file.findElementContaining("Navbar.Item", "AuthMenu.Root");
  const items = file.childElements("Navbar.List", "Navbar.Item");
  const lastItem = items[items.length - 1];
  if (authItem) {
    file.insertBeforeElement(authItem, CART_NAVBAR_ITEM);
  } else if (lastItem) {
    file.insertAfterElement(lastItem, CART_NAVBAR_ITEM);
  } else {
    file.insertBeforeClosingTag(
      "Navbar.List",
      `\n\t\t${CART_NAVBAR_ITEM.replace(/\n/g, "\n\t\t")}\n\t`,
    );
  }

  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
