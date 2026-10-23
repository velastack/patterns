import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALL_FEATURES_OFF } from "../../../../../integration/features";
import type { Options } from "../../../../core/types";
import { siteModule, sitePath } from "../../../../runtime/site";
import { setupWhatsApp } from "./setup-whatsapp";

let root: string;

const options = (input: Record<string, unknown>): Options => ({
  argv: [],
  env: "runtime",
  root,
  features: { ...ALL_FEATURES_OFF },
  input: { silent: true, ...input },
});

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "setup-whatsapp-"));
  fs.mkdirSync(path.dirname(sitePath(root)), { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("setupWhatsApp", () => {
  it("adds the given currency to site.ts", async () => {
    fs.writeFileSync(sitePath(root), siteModule("Centeno"));
    const result = await setupWhatsApp(options({ currency: "mxn" }));
    expect(result.modifies[0]?.content).toContain("currency: 'MXN'");
  });

  it("keeps a currency site.ts already declares", async () => {
    fs.writeFileSync(sitePath(root), siteModule("Centeno", undefined, "EUR"));
    const result = await setupWhatsApp(options({ currency: "MXN" }));
    expect(result.modifies).toEqual([]);
    await expect(setupWhatsApp(options({}))).resolves.toBeDefined();
  });

  it("refuses without a currency, or with one that isn't ISO 4217", async () => {
    fs.writeFileSync(sitePath(root), siteModule("Centeno"));
    await expect(setupWhatsApp(options({}))).rejects.toThrow("Pass --currency");
    await expect(setupWhatsApp(options({ currency: "pesos" }))).rejects.toThrow(
      "pesos is not an ISO 4217 currency code",
    );
  });
});
