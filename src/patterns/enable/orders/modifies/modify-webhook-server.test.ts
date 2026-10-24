import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  modifyWebhookServer,
  unmodifyWebhookServer,
} from "./modify-webhook-server";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "fixtures", "original", "dispatch.ts");

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "orders-dispatch-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("the order handlers in the Stripe dispatcher", () => {
  it("joins the switch ahead of the default, with both imports, once, and comes back out", () => {
    const target = path.join(dir, "dispatch.ts");
    fs.copyFileSync(fixture, target);
    const original = fs.readFileSync(target, "utf8");

    expect(modifyWebhookServer(target)).toEqual({
      status: "success",
      changed: true,
    });
    const out = fs.readFileSync(target, "utf8");
    expect(out).toContain(
      "import { handleCheckoutSessionCompleted } from './checkout/completed';",
    );
    expect(out).toContain(
      "import { handleCheckoutAsyncPayment } from './checkout/async-payment';",
    );
    expect(out).toContain("case 'checkout.session.completed':");
    expect(out).toContain("case 'checkout.session.async_payment_failed':");
    expect(out.indexOf("checkout.session.completed")).toBeGreaterThan(
      out.indexOf("payment_intent.succeeded"),
    );
    expect(out.indexOf("checkout.session.completed")).toBeLessThan(
      out.indexOf("default:"),
    );
    expect(modifyWebhookServer(target)).toEqual({
      status: "success",
      changed: false,
    });

    expect(unmodifyWebhookServer(target)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(target, "utf8")).toBe(original);
  });

  it("asks for payments first when the dispatcher is missing", () => {
    expect(modifyWebhookServer(path.join(dir, "dispatch.ts")).status).toBe(
      "not-found",
    );
  });
});
