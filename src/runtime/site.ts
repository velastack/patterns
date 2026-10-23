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
 * the placeholders filled in, plus the business's currency when one is given.
 */
export function siteModule(
  name: string,
  url = "http://localhost:5173",
  currency?: string,
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
    currency
      ? [`\turl: ${quote(url)},`, ...currencyLines(currency)].join("\n")
      : `\turl: ${quote(url)}`,
    "};",
    "",
  ].join("\n");
}

/** The `currency` property, with what it means; no trailing comma, as the last property. */
function currencyLines(currency: string): string[] {
  return [
    "\t/** ISO 4217: the currency the business prices in and is paid in. */",
    `\tcurrency: ${quote(currency)}`,
  ];
}

/** A three-letter code `Intl` knows, upper-cased; anything else is refused. */
export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  // Any well-formed code formats, so ask for the list of real ones. Node has
  // had it since 18; the repo's ES2020 lib types just don't declare it.
  const intl = Intl as unknown as {
    supportedValuesOf: (key: "currency") => string[];
  };
  return intl.supportedValuesOf("currency").includes(code) ? code : null;
}

const SITE_OBJECT = /export const site = \{\n([\s\S]*?)\n\};/;

/**
 * `src/lib/site.ts` with `currency` added as the object's last property,
 * or `null` when it already has one (a project's currency is never changed
 * behind its back) or has no `export const site = { ... };` to add it to.
 */
export function withSiteCurrency(
  source: string,
  currency: string,
): string | null {
  const match = SITE_OBJECT.exec(source);
  if (!match || /^\s*currency\s*:/m.test(match[1])) return null;
  const body = match[1].replace(/,?\s*$/, ",");
  return source.replace(
    match[0],
    `export const site = {\n${body}\n${currencyLines(currency).join("\n")}\n};`,
  );
}

/** The currency `src/lib/site.ts` declares, if any. */
export function siteCurrency(root: string): string | null {
  try {
    const source = fs.readFileSync(sitePath(root), "utf8");
    return (
      /^\s*currency\s*:\s*['"]([A-Za-z]{3})['"]/m.exec(source)?.[1] ?? null
    );
  } catch {
    return null;
  }
}

/** Single-quoted, as the templates write their strings. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
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
 * Create `src/lib/site.ts` for a pattern whose files import `#lib/site.js`, when
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

/**
 * Make `src/lib/site.ts` declare the business's currency: create the file
 * with it, or add it to an existing one that has none. An existing currency
 * is kept, whatever `currency` says; the result says which it was.
 */
export async function ensureSiteCurrency(
  options: Options,
  currency: string,
): Promise<{ file: File | null; currency: string }> {
  const file = sitePath(options.root);
  if (!fs.existsSync(file)) {
    getLogger(options).info("Creating src/lib/site.ts");
    return {
      file: {
        path: file,
        language: languageFromPath(file),
        content: siteModule(await existingName(options), undefined, currency),
        status: "success",
      },
      currency,
    };
  }
  const existing = siteCurrency(options.root);
  if (existing) return { file: null, currency: existing };
  const next = withSiteCurrency(fs.readFileSync(file, "utf8"), currency);
  if (next === null) return { file: null, currency };
  getLogger(options).info(`Adding currency ${currency} to src/lib/site.ts`);
  return {
    file: {
      path: file,
      language: languageFromPath(file),
      content: next,
      status: "success",
    },
    currency,
  };
}
