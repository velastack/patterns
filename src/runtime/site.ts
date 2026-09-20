import fs from "node:fs";
import path from "node:path";
import type { File, Options } from "../core/types";
import { getLogger } from "../core/logger";
import { languageFromPath } from "../core/util";
import { withPocketbase } from "./pocketbase";

/** Where every VelaStack app keeps its name and public URL. */
export function sitePath(root: string): string {
  return path.join(root, "src", "lib", "site.ts");
}

/**
 * `src/lib/site.ts` as the CLI templates ship it (`site.template.ts`), with
 * the placeholders filled in.
 */
export function siteModule(
  name: string,
  url = "http://localhost:5173",
): string {
  return [
    "/**",
    " * Site-wide metadata, and the one place the app's name and public URL live.",
    " *",
    " * Set `url` to where the site is deployed: canonical links, Open Graph images",
    " * and feeds are built from it, including in prerendered pages. With a backend,",
    " * `vela dev` and `vela deploy` copy `name` into PocketBase's application name",
    " * for the emails it sends, so change it here rather than in the admin panel.",
    " */",
    "export const site = {",
    `\tname: ${quote(name)},`,
    `\turl: ${quote(url)}`,
    "};",
    "",
  ].join("\n");
}

/**
 * Single-quoted, as the templates write their strings — but double-quoted for
 * a value holding more apostrophes than double quotes, which is what prettier
 * leaves behind. An app name like `Tom's Cafe` would otherwise be written as
 * `'Tom\'s Cafe'` and rewritten by the next `npm run lint`.
 */
function quote(value: string): string {
  const count = (mark: string) => value.split(mark).length - 1;
  const mark = count("'") > count('"') ? '"' : "'";
  const escaped = value
    .replace(/\\/g, "\\\\")
    .split(mark)
    .join(`\\${mark}`)
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
  return `${mark}${escaped}${mark}`;
}

/**
 * The name a project created before `site.ts` existed already goes by.
 *
 * Those projects kept it in PocketBase's settings, so that is asked first; the
 * package name is the fallback for a project without a backend, or one whose
 * database can't be reached.
 */
async function existingName(options: Options): Promise<string> {
  if (options.features.backend) {
    try {
      let appName: unknown;
      await withPocketbase(options.root, async (pb) => {
        const settings = (await pb.settings.getAll()) as {
          meta?: { appName?: unknown };
        };
        appName = settings.meta?.appName;
      });
      if (typeof appName === "string" && appName.trim()) return appName;
    } catch {
      // No database to ask; fall through to package.json.
    }
  }

  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(options.root, "package.json"), "utf8"),
    ) as { name?: unknown };
    if (typeof pkg.name === "string" && pkg.name.trim()) return pkg.name;
  } catch {
    // No package.json to name the site after; the placeholder stands.
  }
  return "My App";
}

/**
 * Create `src/lib/site.ts` for a pattern whose files import `$lib/site`, when
 * the project doesn't have one yet. Every template ships it; projects created
 * before that read the app name from `locals.meta` instead.
 *
 * Returns null when the file exists, so an existing one is never overwritten.
 */
export async function ensureSiteFile(options: Options): Promise<File | null> {
  const file = sitePath(options.root);
  if (fs.existsSync(file)) return null;

  getLogger(options).info("Creating src/lib/site.ts");
  return {
    path: file,
    language: languageFromPath(file),
    content: siteModule(await existingName(options)),
    status: "success",
  };
}
