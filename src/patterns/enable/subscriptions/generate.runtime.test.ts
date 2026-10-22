import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InvalidArgumentError } from "../../../core/errors";
import { assertPaymentsAppMode } from "./generate.runtime";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

function makeRoot(files: string[] = []): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-subscriptions-"));
  roots.push(root);
  for (const name of files) {
    const abs = path.join(root, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, "");
  }
  return root;
}

describe("assertPaymentsAppMode", () => {
  it("passes when payments created the billing page", () => {
    const root = makeRoot(["src/routes/(app)/billing/+page.server.ts"]);
    expect(() => assertPaymentsAppMode(root)).not.toThrow();
  });

  it("refuses payments enabled before auth, naming the fix", () => {
    const root = makeRoot(["src/routes/webhooks/stripe/+server.ts"]);
    expect(() => assertPaymentsAppMode(root)).toThrow(InvalidArgumentError);
    expect(() => assertPaymentsAppMode(root)).toThrow(
      "`vela disable payments`, then `vela enable payments`",
    );
  });
});
