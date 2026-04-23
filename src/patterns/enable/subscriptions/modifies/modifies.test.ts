import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../../../../core/test-utils";
import { modifyStripeHooks } from "./modify-stripe-hooks";
import { modifyWebhookServer } from "./modify-webhook-server";
import { modifyAppSidebar } from "./modify-app-sidebar";
import { modifyAppLayoutSvelte } from "./modify-app-layout-svelte";
import { modifyAppLayoutServer } from "./modify-app-layout-server";
import { modifyNavUser } from "./modify-nav-user";
import { modifyBillingPageServer } from "./modify-billing-page-server";
import { modifyBillingPageSvelte } from "./modify-billing-page-svelte";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");
const previewDir = path.join(__dirname, "..", "preview-modifies");

const navUserTemplate = fs.readFileSync(
  path.join(previewDir, "src/lib/components/nav-user.svelte"),
  "utf8",
);
const appLayoutServerTemplate = fs.readFileSync(
  path.join(previewDir, "src/routes/(app)/+layout.server.ts"),
  "utf8",
);
const billingPageServerTemplate = fs.readFileSync(
  path.join(previewDir, "src/routes/(app)/billing/+page.server.ts"),
  "utf8",
);
const billingPageSvelteTemplate = fs.readFileSync(
  path.join(previewDir, "src/routes/(app)/billing/+page.svelte"),
  "utf8",
);

const astCases = [
  {
    file: "stripe.pb.js",
    modify: (target: string) => modifyStripeHooks(target),
  },
  {
    file: "webhook-server.ts",
    modify: (target: string) => modifyWebhookServer(target),
  },
  {
    file: "app-sidebar.svelte",
    modify: (target: string) => modifyAppSidebar(target),
  },
  {
    file: "+layout.svelte",
    modify: (target: string) => modifyAppLayoutSvelte(target),
  },
] as const;

const templateCases = [
  {
    file: "nav-user.svelte",
    modify: (target: string) => modifyNavUser(target, navUserTemplate),
    marker: "planLabel",
  },
  {
    file: "+layout.server.ts",
    modify: (target: string) =>
      modifyAppLayoutServer(target, appLayoutServerTemplate),
    marker: "loadActiveSubscription",
  },
  {
    file: "+page.server.ts",
    modify: (target: string) =>
      modifyBillingPageServer(target, billingPageServerTemplate),
    marker: "selectPlan",
  },
  {
    file: "+page.svelte",
    modify: (target: string) =>
      modifyBillingPageSvelte(target, billingPageSvelteTemplate),
    marker: "availablePlans",
  },
] as const;

describe("subscriptions modifies (AST)", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(astCases)(
    "should modify $file correctly",
    async ({ file, modify }) => {
      const target = path.join(tempDir, file);
      const outcome = modify(target);
      expect(outcome.status).toBe("success");

      const modified = fs.readFileSync(target, "utf8");
      const expected = fs.readFileSync(
        path.join(fixturesPath, "expect", file),
        "utf8",
      );

      await expect(modified).toMatchFormatted(expected, file);
    },
  );

  it("should be idempotent", () => {
    for (const { file, modify } of astCases) {
      const target = path.join(tempDir, file);
      modify(target);
      const first = fs.readFileSync(target, "utf8");
      const second = modify(target);
      expect(second.status).toBe("success");
      expect(fs.readFileSync(target, "utf8")).toBe(first);
    }
  });

  it("reports not-found when targets are missing", () => {
    const missing = path.join(tempDir, "does-not-exist");
    expect(modifyStripeHooks(missing).status).toBe("not-found");
    expect(modifyWebhookServer(missing).status).toBe("not-found");
    expect(modifyAppSidebar(missing).status).toBe("not-found");
    expect(modifyAppLayoutSvelte(missing).status).toBe("not-found");
  });
});

describe("subscriptions modifies (template replacement)", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it.each(templateCases)(
    "rewrites $file with the template",
    ({ file, modify, marker }) => {
      const target = path.join(tempDir, file);
      fs.writeFileSync(target, "// placeholder content without marker", "utf8");
      const outcome = modify(target);
      expect(outcome.status).toBe("success");

      const written = fs.readFileSync(target, "utf8");
      expect(written).toContain(marker);
      // Highlight annotations must be stripped so the written file is valid source.
      expect(written).not.toContain("[!code highlight:");
    },
  );

  it("is idempotent after the marker is present", () => {
    for (const { file, modify } of templateCases) {
      const target = path.join(tempDir, file);
      fs.writeFileSync(target, "// placeholder", "utf8");
      modify(target);
      const first = fs.readFileSync(target, "utf8");
      const second = modify(target);
      expect(second.status).toBe("success");
      expect(fs.readFileSync(target, "utf8")).toBe(first);
    }
  });

  it("reports not-found when targets are missing", () => {
    const missing = path.join(tempDir, "does-not-exist");
    for (const { modify } of templateCases) {
      expect(modify(missing).status).toBe("not-found");
    }
  });
});
