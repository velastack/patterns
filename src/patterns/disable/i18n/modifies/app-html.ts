import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

/**
 * Put a real language back. `%sveltekit.lang%` is not a SvelteKit
 * placeholder; only the wuchale hook replaced it, so without that hook it
 * would be served literally.
 */
export function unmodifyAppHtml(appHtmlPath: string): ModifyOutcome {
  if (!fs.existsSync(appHtmlPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(appHtmlPath, "utf8");
  const updated = original.replace(
    /lang\s*=\s*(?:"%sveltekit\.lang%"|'%sveltekit\.lang%')/g,
    'lang="en"',
  );
  if (updated === original) {
    return { status: "success", changed: false };
  }

  fs.writeFileSync(appHtmlPath, updated, "utf8");
  return { status: "success", changed: true };
}
