import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../../../../core/test-utils";
import { unmodifyStripeHooks } from "./modify-stripe-hooks";
import { unmodifyWebhookServer } from "./modify-webhook-server";
import { unmodifyAppSidebar } from "./modify-app-sidebar";
import { unmodifyAppLayoutSvelte } from "./modify-app-layout-svelte";
import { unmodifyAppLayoutServer } from "./modify-app-layout-server";
import { unmodifyNavUser } from "./modify-nav-user";
import { unmodifyBillingPageServer } from "./modify-billing-page-server";
import { unmodifyBillingPageSvelte } from "./modify-billing-page-svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");
const paymentsPatternDir = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "enable",
  "payments",
);
const subscriptionsPatternDir = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "enable",
  "subscriptions",
);

const paymentsNavUserTemplate = fs.readFileSync(
  path.join(
    paymentsPatternDir,
    "preview-modifies/src/lib/components/nav-user.svelte",
  ),
  "utf8",
);
const paymentsBillingPageServerTemplate = fs.readFileSync(
  path.join(
    paymentsPatternDir,
    "creates-app-mode/src/routes/(app)/billing/+page.server.ts",
  ),
  "utf8",
);
const paymentsBillingPageSvelteTemplate = fs.readFileSync(
  path.join(
    paymentsPatternDir,
    "creates-app-mode/src/routes/(app)/billing/+page.svelte",
  ),
  "utf8",
);

// Enable-subscriptions output content — used as `original` (pre-revert) for
// the template-based revert tests, where fixtures don't exist as separate
// files.
const subsNavUser = fs.readFileSync(
  path.join(
    subscriptionsPatternDir,
    "preview-modifies/src/lib/components/nav-user.svelte",
  ),
  "utf8",
);
const subsAppLayoutServer = fs.readFileSync(
  path.join(
    subscriptionsPatternDir,
    "preview-modifies/src/routes/(app)/+layout.server.ts",
  ),
  "utf8",
);
const subsBillingPageServer = fs.readFileSync(
  path.join(
    subscriptionsPatternDir,
    "preview-modifies/src/routes/(app)/billing/+page.server.ts",
  ),
  "utf8",
);
const subsBillingPageSvelte = fs.readFileSync(
  path.join(
    subscriptionsPatternDir,
    "preview-modifies/src/routes/(app)/billing/+page.svelte",
  ),
  "utf8",
);

const astCases = [
  {
    file: "stripe.pb.js",
    modify: (target: string) => unmodifyStripeHooks(target),
  },
  {
    file: "webhook-server.ts",
    modify: (target: string) => unmodifyWebhookServer(target),
  },
  {
    file: "app-sidebar.svelte",
    modify: (target: string) => unmodifyAppSidebar(target),
  },
  {
    file: "+layout.svelte",
    modify: (target: string) => unmodifyAppLayoutSvelte(target),
  },
] as const;

const templateCases = [
  {
    name: "nav-user.svelte",
    enabledContent: subsNavUser,
    marker: "planLabel",
    modify: (target: string) =>
      unmodifyNavUser(target, paymentsNavUserTemplate),
  },
  {
    name: "+layout.server.ts",
    enabledContent: subsAppLayoutServer,
    marker: "loadActiveSubscription",
    modify: (target: string) => unmodifyAppLayoutServer(target),
  },
  {
    name: "billing/+page.server.ts",
    enabledContent: subsBillingPageServer,
    marker: "selectPlan",
    modify: (target: string) =>
      unmodifyBillingPageServer(target, paymentsBillingPageServerTemplate),
  },
  {
    name: "billing/+page.svelte",
    enabledContent: subsBillingPageSvelte,
    marker: "availablePlans",
    modify: (target: string) =>
      unmodifyBillingPageSvelte(target, paymentsBillingPageSvelteTemplate),
  },
] as const;

describe("disable subscriptions modifies (AST)", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(astCases)("reverts $file correctly", async ({ file, modify }) => {
    const target = path.join(tempDir, file);
    const outcome = modify(target);
    expect(outcome.status).toBe("success");

    const modified = fs.readFileSync(target, "utf8");
    const expected = fs.readFileSync(
      path.join(fixturesPath, "expect", file),
      "utf8",
    );

    await expect(modified).toMatchFormatted(expected, file);
  });

  it("is idempotent", () => {
    for (const { file, modify } of astCases) {
      const target = path.join(tempDir, file);
      modify(target);
      const first = fs.readFileSync(target, "utf8");
      const second = modify(target);
      expect(second.status).toBe("success");
      expect(fs.readFileSync(target, "utf8")).toBe(first);
    }
  });

  it("is a no-op when target is missing", () => {
    const missing = path.join(tempDir, "does-not-exist");
    expect(unmodifyStripeHooks(missing)).toEqual({
      status: "success",
      changed: false,
    });
    expect(unmodifyWebhookServer(missing)).toEqual({
      status: "success",
      changed: false,
    });
    expect(unmodifyAppSidebar(missing)).toEqual({
      status: "success",
      changed: false,
    });
    expect(unmodifyAppLayoutSvelte(missing)).toEqual({
      status: "success",
      changed: false,
    });
  });
});

describe("disable subscriptions modifies (template revert)", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(templateCases)(
    "reverts $name when the enabled marker is present",
    ({ name, enabledContent, marker, modify }) => {
      const target = path.join(tempDir, path.basename(name));
      fs.writeFileSync(target, enabledContent, "utf8");
      expect(fs.readFileSync(target, "utf8")).toContain(marker);

      const outcome = modify(target);
      expect(outcome.status).toBe("success");

      const written = fs.readFileSync(target, "utf8");
      expect(written).not.toContain(marker);
      expect(written).not.toContain("[!code highlight:");
    },
  );

  it("is a no-op when file doesn't contain the enabled marker", () => {
    for (const { name, modify } of templateCases) {
      const target = path.join(tempDir, path.basename(name));
      const pristine = "// already reverted\n";
      fs.writeFileSync(target, pristine, "utf8");
      const outcome = modify(target);
      expect(outcome).toEqual({ status: "success", changed: false });
      expect(fs.readFileSync(target, "utf8")).toBe(pristine);
    }
  });

  it("is idempotent", () => {
    for (const { name, enabledContent, modify } of templateCases) {
      const target = path.join(tempDir, path.basename(name));
      fs.writeFileSync(target, enabledContent, "utf8");
      modify(target);
      const first = fs.readFileSync(target, "utf8");
      const second = modify(target);
      expect(second.status).toBe("success");
      expect(fs.readFileSync(target, "utf8")).toBe(first);
    }
  });

  it("is a no-op when target is missing", () => {
    const missing = path.join(tempDir, "does-not-exist");
    for (const { modify } of templateCases) {
      expect(modify(missing)).toEqual({ status: "success", changed: false });
    }
  });
});
