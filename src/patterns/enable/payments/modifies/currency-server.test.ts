import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  modifyHooksServerCurrency,
  unmodifyHooksServerCurrency,
} from "./hooks.server";
import {
  modifyLayoutServerCurrency,
  unmodifyLayoutServerCurrency,
} from "./layout.server";
import {
  modifyLayoutSvelteCurrency,
  unmodifyLayoutSvelteCurrency,
} from "./layout.svelte";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "fixtures", "original");

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "currency-server-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function copy(fixture: string, name = fixture): string {
  const target = path.join(dir, name);
  fs.copyFileSync(path.join(fixtures, fixture), target);
  return target;
}

describe("handleCurrency in hooks.server.ts", () => {
  it("joins the template's handle in a sequence, once, and comes back out", () => {
    const target = copy("hooks.server.ts");
    const original = fs.readFileSync(target, "utf8");
    expect(modifyHooksServerCurrency(target)).toEqual({
      status: "success",
      changed: true,
    });
    const out = fs.readFileSync(target, "utf8");
    expect(out).toContain(
      "import { handleCurrency } from '#lib/currency.server.js';",
    );
    expect(out).toMatch(/sequence\([\s\S]*handleCurrency/);
    expect(out).toContain("startWorker()");
    expect(modifyHooksServerCurrency(target)).toEqual({
      status: "success",
      changed: false,
    });

    expect(unmodifyHooksServerCurrency(target)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(target, "utf8")).toBe(original);
  });

  it("creates the file for a project without one", () => {
    const target = path.join(dir, "hooks.server.ts");
    expect(modifyHooksServerCurrency(target)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(target, "utf8")).toContain(
      "export const handle = handleCurrency;",
    );
  });
});

describe("currency and rates in the root +layout.server.ts", () => {
  it("adds locals to the loadFlash load's parameter and both properties after the spread", () => {
    const target = copy("layout.server.ts", "+layout.server.ts");
    const original = fs.readFileSync(target, "utf8");
    expect(modifyLayoutServerCurrency(target)).toEqual({
      status: "success",
      changed: true,
    });
    const out = fs.readFileSync(target, "utf8");
    expect(out).toContain(
      "import { displayRates } from '#lib/currency.server.js';",
    );
    expect(out).toContain("loadFlash(async ({ url, locals }) => {");
    expect(out).toContain("currency: locals.currency");
    expect(out).toContain("rates: await displayRates(locals.currency)");
    expect(out.indexOf("...baseTags")).toBeLessThan(
      out.indexOf("currency: locals.currency"),
    );
    expect(modifyLayoutServerCurrency(target)).toEqual({
      status: "success",
      changed: false,
    });

    expect(unmodifyLayoutServerCurrency(target)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(target, "utf8")).toBe(original);
  });

  it("refuses a load that is not async, leaving it as it was", () => {
    const target = path.join(dir, "+layout.server.ts");
    const source =
      "export const load = ({ locals }) => {\n\treturn { a: 1 };\n};\n";
    fs.writeFileSync(target, source);
    const outcome = modifyLayoutServerCurrency(target);
    expect(outcome.status).toBe("failed");
    expect(fs.readFileSync(target, "utf8")).toBe(source);
  });

  it("reads locals off a named event", () => {
    const target = path.join(dir, "+layout.server.ts");
    fs.writeFileSync(
      target,
      "export const load = async (event) => {\n\treturn { a: event.url.pathname };\n};\n",
    );
    expect(modifyLayoutServerCurrency(target).status).toBe("success");
    const out = fs.readFileSync(target, "utf8");
    expect(out).toContain("currency: event.locals.currency");
    expect(out).toContain("rates: await displayRates(event.locals.currency)");
  });
});

describe("hydrating the store in the root +layout.svelte", () => {
  it("imports the store and hydrates right after the props, once, and comes back out", () => {
    const target = copy("layout.svelte", "+layout.svelte");
    const original = fs.readFileSync(target, "utf8");
    expect(modifyLayoutSvelteCurrency(target)).toEqual({
      status: "success",
      changed: true,
    });
    const out = fs.readFileSync(target, "utf8");
    expect(out).toContain(
      "import { currency } from '#lib/currency.svelte.js';",
    );
    const props = out.indexOf("= $props();");
    const hydrate = out.indexOf("currency.hydrate(data.currency, data.rates);");
    expect(hydrate).toBeGreaterThan(props);
    expect(out.slice(props, hydrate)).not.toContain("getFlash(");
    expect(modifyLayoutSvelteCurrency(target)).toEqual({
      status: "success",
      changed: false,
    });

    expect(unmodifyLayoutSvelteCurrency(target)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(target, "utf8")).toBe(original);
  });

  it("adds a data prop to a layout without one, and takes it back out", () => {
    const target = path.join(dir, "+layout.svelte");
    const source =
      "<script lang=\"ts\">\n\timport '../app.css';\n\n\tlet { children } = $props();\n</script>\n\n{@render children?.()}\n";
    fs.writeFileSync(target, source);
    expect(modifyLayoutSvelteCurrency(target).status).toBe("success");
    const out = fs.readFileSync(target, "utf8");
    expect(out).toContain("let { children, data } = $props();");
    expect(out).toContain("currency.hydrate(data.currency, data.rates);");
    expect(unmodifyLayoutSvelteCurrency(target).status).toBe("success");
    expect(fs.readFileSync(target, "utf8")).toBe(source);
  });
});
