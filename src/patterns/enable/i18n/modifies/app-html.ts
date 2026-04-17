import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = [
  "Add the sveltekit lang placeholder to the <html> tag:",
  "",
  '<html lang="%sveltekit.lang%">',
].join("\n");

const NOT_FOUND_HINT = [
  "Create src/app.html with a lang placeholder:",
  "",
  "<!doctype html>",
  '<html lang="%sveltekit.lang%">',
  "  <head>",
  '    <meta charset="utf-8" />',
  "    %sveltekit.head%",
  "  </head>",
  '  <body data-sveltekit-preload-data="hover">',
  '    <div style="display: contents">%sveltekit.body%</div>',
  "  </body>",
  "</html>",
].join("\n");

export function modifyAppHtml(appHtmlPath: string): ModifyOutcome {
  if (!fs.existsSync(appHtmlPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(appHtmlPath, "utf8");
  if (
    original.includes('lang="%sveltekit.lang%"') ||
    original.includes("lang='%sveltekit.lang%'")
  ) {
    return { status: "success", changed: false };
  }

  const updated = original.replace(/<html(\s[^>]*?)?>/i, (match) => {
    if (/lang\s*=/.test(match)) {
      return match;
    }
    return match.replace(/<html/i, '<html lang="%sveltekit.lang%"');
  });

  if (updated === original) {
    return { status: "failed", message: FAILURE_HINT };
  }
  fs.writeFileSync(appHtmlPath, updated);
  return { status: "success", changed: true };
}
