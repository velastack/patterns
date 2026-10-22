import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";
import { libModule } from "../../../../runtime/lib-specifier";

/** Takes out the navbar item enable-ecommerce added, and its import. */
export function unmodifyRootLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(layoutPath);
  if (!file.hasElement("CartButton")) {
    return { status: "success", changed: false };
  }

  if (!file.removeElementContaining("Navbar.Item", "CartButton")) {
    file.removeElement("CartButton");
  }
  file.modifyScript((content) => {
    const { source: out } = withInMemoryScript(content, (sf) => {
      removeImportByModuleSpecifier(
        sf,
        libModule("components/cart/cart-button.svelte"),
      );
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });

  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
