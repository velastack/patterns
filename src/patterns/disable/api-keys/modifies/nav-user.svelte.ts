import fs from "node:fs";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { removeNavItemFromScript } from "../../../../runtime/ts-morph-helpers";
import type { ModifyOutcome } from "../../../../core/types";

export function unmodifyNavUser(navUserPath: string): ModifyOutcome {
  if (!fs.existsSync(navUserPath)) {
    return { status: "success", changed: false };
  }

  const source = fs.readFileSync(navUserPath, "utf8");
  if (!source.includes("/api-keys")) {
    return { status: "success", changed: false };
  }

  const file = new SvelteFile(source);
  let wasRemoved = false;

  const tryRemove = (run: (fn: (s: string) => string) => boolean) => {
    if (wasRemoved) return;
    run((src) => {
      const result = removeNavItemFromScript(
        src,
        "API Keys",
        "@lucide/svelte/icons/key-round",
      );
      if (result.wasRemoved) wasRemoved = true;
      return result.source;
    });
  };

  tryRemove((fn) => file.modifyModuleScript(fn));
  if (!wasRemoved) tryRemove((fn) => file.modifyScript(fn));

  if (!wasRemoved) {
    return { status: "success", changed: false };
  }

  fs.writeFileSync(navUserPath, file.toString(), "utf8");
  return { status: "success", changed: true };
}
