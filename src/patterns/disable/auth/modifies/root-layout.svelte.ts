import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  ensureBlankLineAfterImports,
  removeImportByModuleSpecifier,
  removePropsBindingIfUnused,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";
import { libModule } from "../../../../runtime/lib-specifier";

export function unmodifyRootLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const source = fs.readFileSync(layoutPath, "utf8");
  const file = new SvelteFile(source);
  if (!file.hasElement("AuthMenu.Root")) {
    return { status: "success", changed: false };
  }

  file.removeElement("AuthMenu.Root");
  const markup = file.toString().replace(/<script[\s\S]*?<\/script>/g, "");

  file.modifyScript((content) => {
    const { source: out } = withInMemoryScript(content, (sf) => {
      removeImportByModuleSpecifier(sf, libModule("components/ui/auth-menu"));
      removeImportByModuleSpecifier(
        sf,
        libModule("components/user-avatar.svelte"),
      );
      // Layouts from before UserAvatar import the avatar parts directly.
      removeImportByModuleSpecifier(sf, libModule("components/ui/avatar"));
      // enable-auth added `data` for the menu's `data.user`.
      removePropsBindingIfUnused(sf, "data", markup);
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });

  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
