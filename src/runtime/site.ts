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
 * What a business declares about itself in `src/lib/site.ts`, next to the
 * app's name: the currency it prices in and is paid in, the country it is in
 * (prices format for it: `es-MX`, not `es`) and the other currencies it shows
 * prices in, as estimates. Every property is optional; a payments provider
 * asks for what it needs.
 */
export interface SiteBusiness {
  /** ISO 4217, e.g. `MXN`. */
  currency?: string;
  /** ISO 3166-1 alpha-2, e.g. `MX`. */
  country?: string;
  /** ISO 4217 codes the site also shows prices in; empty means the home currency only. */
  currencies?: string[];
}

type BusinessKey = keyof SiteBusiness;

const BUSINESS_KEYS: BusinessKey[] = ["currency", "country", "currencies"];

/**
 * `src/lib/site.ts` as the CLI templates ship it (`site.template.ts`), with
 * the placeholders filled in, plus whatever the business declares.
 */
export function siteModule(
  name: string,
  url = "http://localhost:5173",
  business: SiteBusiness | string = {},
): string {
  // The old third argument was the currency alone.
  const declared: SiteBusiness =
    typeof business === "string" ? { currency: business } : business;
  const lines = BUSINESS_KEYS.filter((key) => declared[key] !== undefined).map(
    (key) => propertyLines(key, declared[key]!),
  );
  const properties = [
    `\tname: ${quote(name)},`,
    `\turl: ${quote(url)}`,
    ...lines.map((entry) => entry.join("\n")),
  ];
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
    // Every property but the last ends in a comma.
    ...properties.map((entry, i) =>
      i < properties.length - 1 ? ensureComma(entry) : entry,
    ),
    "};",
    "",
  ].join("\n");
}

function ensureComma(entry: string): string {
  return entry.endsWith(",") ? entry : `${entry},`;
}

/** A property's lines: its doc comment, then `key: value` with no trailing comma. */
function propertyLines(key: BusinessKey, value: string | string[]): string[] {
  switch (key) {
    case "currency":
      return [
        "\t/** ISO 4217: the currency the business prices in and is paid in. */",
        `\tcurrency: ${quote(value as string)}`,
      ];
    case "country":
      return [
        "\t/** ISO 3166-1: the country the business is in; prices format for it. */",
        `\tcountry: ${quote(value as string)}`,
      ];
    case "currencies":
      return [
        "\t/** Other currencies prices are shown in, as estimates at the day's rate. */",
        `\tcurrencies: [${(value as string[]).map(quote).join(", ")}]`,
      ];
  }
}

const SUPPORTED_CURRENCIES = (
  Intl as unknown as {
    supportedValuesOf: (key: "currency") => string[];
  }
).supportedValuesOf("currency");

/** A three-letter code `Intl` knows, upper-cased; anything else is refused. */
export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  // Any well-formed code formats, so ask for the list of real ones. Node has
  // had it since 18; the repo's ES2020 lib types just don't declare it.
  return SUPPORTED_CURRENCIES.includes(code) ? code : null;
}

/** A two-letter ISO 3166-1 code, upper-cased; anything else is refused. */
export function normalizeCountry(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  // `Intl.DisplayNames` knows every region; an unknown one comes back as is.
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return names.of(code) !== code ? code : null;
}

/**
 * A list of currency codes, from an array or a comma-separated string,
 * upper-cased and deduplicated; `null` when any entry is not a currency.
 * `home` is left out: the business's own currency is never a display one.
 */
export function normalizeCurrencies(
  raw: unknown,
  home?: string,
): string[] | null {
  const entries = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\s]+/)
      : null;
  if (!entries) return null;
  const codes: string[] = [];
  for (const entry of entries) {
    if (entry === "" || entry === undefined) continue;
    const code = normalizeCurrency(entry);
    if (!code) return null;
    if (code !== home && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

const SITE_OBJECT = /export const site = \{\n([\s\S]*?)\n\};/;

/**
 * `src/lib/site.ts` with `key` added as the object's last property, or
 * `null` when it already has one (a project's declaration is never changed
 * behind its back) or has no `export const site = { ... };` to add it to.
 */
export function withSiteProperty(
  source: string,
  key: BusinessKey,
  value: string | string[],
): string | null {
  const match = SITE_OBJECT.exec(source);
  if (!match || new RegExp(`^\\s*${key}\\s*:`, "m").test(match[1])) return null;
  const body = match[1].replace(/,?\s*$/, ",");
  return source.replace(
    match[0],
    `export const site = {\n${body}\n${propertyLines(key, value).join("\n")}\n};`,
  );
}

/** `withSiteProperty` for the currency, as the Phase 1.5 code called it. */
export function withSiteCurrency(
  source: string,
  currency: string,
): string | null {
  return withSiteProperty(source, "currency", currency);
}

/** What `src/lib/site.ts` declares about the business, if anything. */
export function siteBusiness(root: string): SiteBusiness {
  let source: string;
  try {
    source = fs.readFileSync(sitePath(root), "utf8");
  } catch {
    return {};
  }
  const text = (key: string, shape: string) =>
    new RegExp(`^\\s*${key}\\s*:\\s*['"](${shape})['"]`, "m").exec(source)?.[1];
  const list = /^\s*currencies\s*:\s*\[([^\]]*)\]/m.exec(source)?.[1];
  const business: SiteBusiness = {};
  const currency = text("currency", "[A-Za-z]{3}");
  if (currency) business.currency = currency;
  const country = text("country", "[A-Za-z]{2}");
  if (country) business.country = country;
  if (list !== undefined) {
    business.currencies = [...list.matchAll(/['"]([A-Za-z]{3})['"]/g)].map(
      (m) => m[1],
    );
  }
  return business;
}

/** The currency `src/lib/site.ts` declares, if any. */
export function siteCurrency(root: string): string | null {
  return siteBusiness(root).currency ?? null;
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
 * Make `src/lib/site.ts` declare what the business says about itself: create
 * the file with it, or add the properties an existing one lacks. A property
 * already there is kept, whatever `business` says; the result says what the
 * file declares after the call, and the file to write, if anything changed.
 */
export async function ensureSiteBusiness(
  options: Options,
  business: SiteBusiness,
): Promise<{ file: File | null; business: SiteBusiness }> {
  const file = sitePath(options.root);
  const wanted = BUSINESS_KEYS.filter((key) => business[key] !== undefined);
  if (!fs.existsSync(file)) {
    if (wanted.length === 0) return { file: null, business: {} };
    getLogger(options).info("Creating src/lib/site.ts");
    return {
      file: {
        path: file,
        language: languageFromPath(file),
        content: siteModule(await existingName(options), undefined, business),
        status: "success",
      },
      business,
    };
  }

  const existing = siteBusiness(options.root);
  let source = fs.readFileSync(file, "utf8");
  const added: string[] = [];
  for (const key of wanted) {
    if (existing[key] !== undefined) continue;
    const next = withSiteProperty(source, key, business[key]!);
    if (next === null) continue;
    source = next;
    added.push(key);
    (existing as Record<string, unknown>)[key] = business[key];
  }
  if (added.length === 0) return { file: null, business: existing };
  getLogger(options).info(`Adding ${added.join(", ")} to src/lib/site.ts`);
  return {
    file: {
      path: file,
      language: languageFromPath(file),
      content: source,
      status: "success",
    },
    business: existing,
  };
}

/** `ensureSiteBusiness` for the currency alone, as the Phase 1.5 code called it. */
export async function ensureSiteCurrency(
  options: Options,
  currency: string,
): Promise<{ file: File | null; currency: string }> {
  const { file, business } = await ensureSiteBusiness(options, { currency });
  return { file, currency: business.currency ?? currency };
}
