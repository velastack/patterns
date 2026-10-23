import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Options } from "../core/types";
import {
  ensureSiteBusiness,
  ensureSiteCurrency,
  ensureSiteFile,
  normalizeCountry,
  normalizeCurrencies,
  normalizeCurrency,
  siteBusiness,
  siteCurrency,
  siteModule,
  sitePath,
  withSiteCurrency,
  withSiteProperty,
} from "./site";

let root: string;

function options(backend = false): Options {
  return {
    argv: [],
    env: "runtime",
    root,
    features: {
      auth: false,
      api: false,
      apiKeys: false,
      backend,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
      cms: false,
    },
    input: { silent: true },
  };
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "site-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("siteModule", () => {
  it("fills name and url as single-quoted strings", () => {
    const source = siteModule("Tom's Cafe", "https://example.com");
    expect(source).toContain("name: 'Tom\\'s Cafe',");
    expect(source).toContain("url: 'https://example.com'");
    expect(source).toContain("export const site = {");
  });
});

describe("ensureSiteFile", () => {
  it("never replaces an existing site.ts", async () => {
    fs.mkdirSync(path.dirname(sitePath(root)), { recursive: true });
    fs.writeFileSync(sitePath(root), "export const site = { name: 'Mine' };\n");
    expect(await ensureSiteFile(options())).toBeNull();
  });

  it("names a new one after the package", async () => {
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "my-app" }),
    );
    const file = await ensureSiteFile(options());
    expect(file?.path).toBe(sitePath(root));
    expect(file?.content).toContain("name: 'my-app',");
    expect(file?.content).toContain("url: 'http://localhost:5173'");
  });

  it("falls back to the package when PocketBase can't be asked", async () => {
    // A backend project with no data/ directory: withPocketbase throws.
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "my-app" }),
    );
    const file = await ensureSiteFile(options(true));
    expect(file?.content).toContain("name: 'my-app',");
  });
});

describe("currency", () => {
  it("normalizes real ISO 4217 codes and refuses the rest", () => {
    expect(normalizeCurrency(" mxn ")).toBe("MXN");
    expect(normalizeCurrency("EUR")).toBe("EUR");
    expect(normalizeCurrency("ABC")).toBeNull();
    expect(normalizeCurrency("$")).toBeNull();
    expect(normalizeCurrency(undefined)).toBeNull();
  });

  it("adds currency as the last property, once", () => {
    const source = siteModule("Centeno", "https://centeno.mx");
    const next = withSiteCurrency(source, "MXN");
    expect(next).toContain("\turl: 'https://centeno.mx',\n");
    expect(next).toContain("\tcurrency: 'MXN'\n};");
    expect(withSiteCurrency(next!, "USD")).toBeNull();
  });

  it("handles a trailing comma and extra properties", () => {
    const source =
      "export const site = {\n\tname: 'A',\n\turl: 'https://a.test',\n\tcmsEndpoint: '',\n};\n";
    expect(withSiteCurrency(source, "EUR")).toBe(
      "export const site = {\n\tname: 'A',\n\turl: 'https://a.test',\n\tcmsEndpoint: '',\n" +
        "\t/** ISO 4217: the currency the business prices in and is paid in. */\n" +
        "\tcurrency: 'EUR'\n};\n",
    );
  });

  it("creates site.ts with the currency, or keeps the one already there", async () => {
    const created = await ensureSiteCurrency(options(), "MXN");
    expect(created.currency).toBe("MXN");
    expect(created.file?.content).toContain("currency: 'MXN'");

    fs.mkdirSync(path.dirname(sitePath(root)), { recursive: true });
    fs.writeFileSync(sitePath(root), siteModule("A", undefined, "EUR"));
    expect(siteCurrency(root)).toBe("EUR");
    expect(await ensureSiteCurrency(options(), "MXN")).toEqual({
      file: null,
      currency: "EUR",
    });
  });
});

describe("business", () => {
  it("normalizes countries and currency lists, leaving the home currency out", () => {
    expect(normalizeCountry(" mx ")).toBe("MX");
    expect(normalizeCountry("XX")).toBeNull();
    expect(normalizeCountry("Mexico")).toBeNull();
    expect(normalizeCurrencies("usd, eur,MXN", "MXN")).toEqual(["USD", "EUR"]);
    expect(normalizeCurrencies(["USD", "usd"])).toEqual(["USD"]);
    expect(normalizeCurrencies("")).toEqual([]);
    expect(normalizeCurrencies("USD, pesos")).toBeNull();
    expect(normalizeCurrencies(undefined)).toBeNull();
  });

  it("writes the three properties into a new site.ts, each as the last one", () => {
    const source = siteModule("Centeno", "https://centeno.mx", {
      currency: "MXN",
      country: "MX",
      currencies: ["USD", "EUR"],
    });
    expect(source).toContain("\tcurrency: 'MXN',\n");
    expect(source).toContain("\tcountry: 'MX',\n");
    expect(source).toContain("\tcurrencies: ['USD', 'EUR']\n};");
    expect(siteModule("A", undefined, "EUR")).toContain(
      "\tcurrency: 'EUR'\n};",
    );
  });

  it("adds a property to an existing site.ts and reads them all back", () => {
    const base = siteModule("A", "https://a.test", "MXN");
    const withCountry = withSiteProperty(base, "country", "MX")!;
    const all = withSiteProperty(withCountry, "currencies", ["USD"])!;
    expect(withSiteProperty(all, "country", "US")).toBeNull();
    fs.mkdirSync(path.dirname(sitePath(root)), { recursive: true });
    fs.writeFileSync(sitePath(root), all);
    expect(siteBusiness(root)).toEqual({
      currency: "MXN",
      country: "MX",
      currencies: ["USD"],
    });
  });

  it("ensures only what is missing, and keeps what is declared", async () => {
    fs.mkdirSync(path.dirname(sitePath(root)), { recursive: true });
    fs.writeFileSync(sitePath(root), siteModule("A", undefined, "EUR"));
    const result = await ensureSiteBusiness(options(), {
      currency: "MXN",
      country: "ES",
      currencies: ["USD"],
    });
    expect(result.business).toEqual({
      currency: "EUR",
      country: "ES",
      currencies: ["USD"],
    });
    expect(result.file?.content).toContain("country: 'ES'");
    expect(result.file?.content).not.toContain("MXN");
    fs.writeFileSync(sitePath(root), result.file!.content);
    expect(await ensureSiteBusiness(options(), { currency: "MXN" })).toEqual({
      file: null,
      business: { currency: "EUR", country: "ES", currencies: ["USD"] },
    });
  });
});
