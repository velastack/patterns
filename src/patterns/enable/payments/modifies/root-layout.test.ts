import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  modifyRootLayoutCurrencySelect,
  unmodifyRootLayoutCurrencySelect,
} from "./root-layout.svelte";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "fixtures", "original");
const ecommerceFixtures = path.join(
  here,
  "..",
  "..",
  "ecommerce",
  "modifies",
  "fixtures",
  "original",
);

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "currency-select-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function copy(from: string): string {
  const target = path.join(dir, "root-layout.svelte");
  fs.copyFileSync(from, target);
  return target;
}

describe("the currency select in the navbar", () => {
  it("goes in as the last item, with its import, once", () => {
    const target = copy(path.join(ecommerceFixtures, "basic-layout.svelte"));
    expect(modifyRootLayoutCurrencySelect(target)).toEqual({
      status: "success",
      changed: true,
    });
    const out = fs.readFileSync(target, "utf8");
    expect(out).toContain(
      "import CurrencySelect from '#lib/components/currency-select.svelte';",
    );
    expect(out.match(/<CurrencySelect \/>/g)).toHaveLength(1);
    // After the Home item, before the list closes.
    expect(out.indexOf("<CurrencySelect />")).toBeGreaterThan(
      out.indexOf("Home"),
    );
    expect(out.indexOf("<CurrencySelect />")).toBeLessThan(
      out.indexOf("</Navbar.List>"),
    );
    expect(modifyRootLayoutCurrencySelect(target)).toEqual({
      status: "success",
      changed: false,
    });
  });

  it("sits right after the language select when there is one", () => {
    const target = copy(path.join(fixtures, "currency-layout.svelte"));
    expect(modifyRootLayoutCurrencySelect(target).status).toBe("success");
    const out = fs.readFileSync(target, "utf8");
    const language = out.indexOf("<LanguageSelect />");
    const currency = out.indexOf("<CurrencySelect />");
    expect(currency).toBeGreaterThan(language);
    // Only the language item's closing tag lies between them.
    expect(out.slice(language, currency).match(/<Navbar\.Item>/g)).toHaveLength(
      1,
    );
  });

  it("fails with a hint when there is no navbar, and is not-found without a layout", () => {
    const target = copy(
      path.join(ecommerceFixtures, "no-navbar-layout.svelte"),
    );
    const outcome = modifyRootLayoutCurrencySelect(target);
    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed")
      expect(outcome.message).toContain("Navbar.List");
    expect(
      modifyRootLayoutCurrencySelect(path.join(dir, "missing.svelte")).status,
    ).toBe("not-found");
  });

  it("comes back out, leaving the layout as it was", () => {
    for (const fixture of [
      path.join(ecommerceFixtures, "basic-layout.svelte"),
      path.join(fixtures, "currency-layout.svelte"),
    ]) {
      const target = copy(fixture);
      const original = fs.readFileSync(target, "utf8");
      modifyRootLayoutCurrencySelect(target);
      expect(unmodifyRootLayoutCurrencySelect(target)).toEqual({
        status: "success",
        changed: true,
      });
      expect(fs.readFileSync(target, "utf8")).toBe(original);
      expect(unmodifyRootLayoutCurrencySelect(target)).toEqual({
        status: "success",
        changed: false,
      });
    }
  });
});
