import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import {
  removeImportByModuleSpecifier,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

export function unmodifyRootLayoutNegotiate(
  layoutPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }

  const file = SvelteFile.fromPath(layoutPath);
  const hasElement = file.hasElement("Negotiate");

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      removeImportByModuleSpecifier(sf, "$lib/negotiate");
    });
    return out;
  });

  if (hasElement) {
    file.removeElement("Negotiate");
  }

  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
