import fs from "node:fs";

export function modifyAppHtml(appHtmlPath: string) {
  if (!fs.existsSync(appHtmlPath)) return false;

  const original = fs.readFileSync(appHtmlPath, "utf8");
  if (
    original.includes('lang="%sveltekit.lang%"') ||
    original.includes("lang='%sveltekit.lang%'")
  ) {
    return false;
  }

  const updated = original.replace(/<html(\s[^>]*?)?>/i, (match) => {
    if (/lang\s*=/.test(match)) {
      return match;
    }
    return match.replace(/<html/i, '<html lang="%sveltekit.lang%"');
  });

  if (updated === original) return false;
  fs.writeFileSync(appHtmlPath, updated);
  return true;
}
