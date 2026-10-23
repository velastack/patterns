import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ALL_FEATURES_OFF } from "../../../../../integration/features";
import type { Options } from "../../../../core/types";
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
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("setupWhatsApp", () => {
  it("runs once site.ts declares a currency", async () => {
    const result = await setupWhatsApp(options({ currency: "MXN" }), {
      currency: "MXN",
    });
    expect(result.modifies).toEqual([]);
  });

  it("refuses without a currency, or with one that isn't ISO 4217", async () => {
    await expect(setupWhatsApp(options({}), {})).rejects.toThrow(
      "Pass --currency",
    );
    await expect(
      setupWhatsApp(options({ currency: "pesos" }), {}),
    ).rejects.toThrow("pesos is not an ISO 4217 currency code");
  });

  it("lists the order message for wuchale when the project has it", async () => {
    fs.writeFileSync(
      path.join(root, "wuchale.config.js"),
      `export default { adapters: { js: js({ loader: "vite", files: ["src/**/+page.ts"] }) } };\n`,
    );
    const result = await setupWhatsApp(options({}), { currency: "MXN" });
    expect(result.modifies[0]?.content).toContain('"src/lib/order.ts"');
  });
});
