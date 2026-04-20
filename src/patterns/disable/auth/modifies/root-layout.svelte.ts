import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  removeImportByModuleSpecifier,
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

  file.modifyScript((content) => {
    const { source: out } = withInMemoryScript(content, (sf) => {
      removeImportByModuleSpecifier(sf, "$lib/components/ui/auth-menu");
      removeImportByModuleSpecifier(sf, "$lib/components/ui/avatar");
    });
    return out;
  });

  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
