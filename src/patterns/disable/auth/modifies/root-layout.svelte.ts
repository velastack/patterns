import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  removeImportByModuleSpecifier,
  removePropsBindingIfUnused,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

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
      removeImportByModuleSpecifier(sf, "$lib/components/ui/auth-menu");
      removeImportByModuleSpecifier(sf, "$lib/components/ui/avatar");
      // enable-auth added `data` for the menu's `data.user`.
      removePropsBindingIfUnused(sf, "data", markup);
    });
    return out;
  });

  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
