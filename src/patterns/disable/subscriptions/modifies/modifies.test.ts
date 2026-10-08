import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../../../../core/test-utils";
import { unmodifyWebhookServer } from "./modify-webhook-server";
import { unmodifyAppSidebar } from "./modify-app-sidebar";
import { unmodifyAppLayoutSvelte } from "./modify-app-layout-svelte";
import { unmodifyAppLayoutServer } from "./modify-app-layout-server";
import { unmodifyNavUser } from "./modify-nav-user";
import { unmodifyBillingPageServer } from "./modify-billing-page-server";
import { unmodifyBillingPageSvelte } from "./modify-billing-page-svelte";
import { modifyAppLayoutServer } from "../../../enable/subscriptions/modifies/modify-app-layout-server";
import { modifyNavUser } from "../../../enable/subscriptions/modifies/modify-nav-user";

/** The (app) layout load the velastack-auth baseline ships. */
const STOCK_LAYOUT_SERVER = `export const load = ({ locals }) => {
\tconst user = locals.pb.authStore.record!;
\tconst breadcrumbs = [{ title: 'Home', url: '/dashboard' }];

\treturn { user, breadcrumbs };
};
`;

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
    file: "dispatch.ts",
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
  // Written before SvelteKit 3: the old lib alias.
  {
    file: "legacy-app-sidebar.svelte",
    modify: (target: string) => unmodifyAppSidebar(target),
  },
  {
    file: "legacy-+layout.svelte",
    modify: (target: string) => unmodifyAppLayoutSvelte(target),
  },
] as const;

const templateCases = [
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

  it("removes single-quoted subscription case clauses", () => {
    const target = path.join(tempDir, "dispatch.ts");
    const original = fs.readFileSync(target, "utf8");
    const singleQuoted = original.replace(
      /"customer\.subscription\.(created|updated|deleted)"/g,
      "'customer.subscription.$1'",
    );
    expect(singleQuoted).toContain("'customer.subscription.created'");
    fs.writeFileSync(target, singleQuoted, "utf8");

    unmodifyWebhookServer(target);

    const modified = fs.readFileSync(target, "utf8");
    expect(modified).not.toContain("customer.subscription.created");
    expect(modified).not.toContain("customer.subscription.updated");
    expect(modified).not.toContain("customer.subscription.deleted");
    expect(modified).not.toContain("handleSubscriptionCreated");
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

describe("disable subscriptions modifies (files other patterns edit too)", () => {
  const strip = (source: string) =>
    source
      .replace(/^[ \t]*\/\/[ \t]*\[!code highlight:\d+\][ \t]*\r?\n/gm, "")
      .replace(
        /^[ \t]*<!--[ \t]*\[!code highlight:\d+\][ \t]*-->[ \t]*\r?\n/gm,
        "",
      );
  const teamsDir = path.join(
    __dirname,
    "../../../enable/teams/modifies/fixtures/expect",
  );
  const write = (file: string, content: string) => {
    const target = path.join(tempDir, file);
    fs.writeFileSync(target, content, "utf8");
    return target;
  };

  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("takes the subscription out of the layout load the preview shows", async () => {
    const target = write("+layout.server.ts", strip(subsAppLayoutServer));
    expect(unmodifyAppLayoutServer(target)).toEqual({
      status: "success",
      changed: true,
    });
    await expect(fs.readFileSync(target, "utf8")).toMatchFormatted(
      STOCK_LAYOUT_SERVER,
      "+layout.server.ts",
    );
  });

  it("takes the plan label out of the nav-user the preview shows", async () => {
    const target = write("nav-user.svelte", strip(subsNavUser));
    expect(unmodifyNavUser(target)).toEqual({
      status: "success",
      changed: true,
    });
    await expect(fs.readFileSync(target, "utf8")).toMatchFormatted(
      strip(paymentsNavUserTemplate),
      "nav-user.svelte",
    );
  });

  it("round-trips the teams layout load and nav-user", async () => {
    for (const file of ["+layout.server.ts", "nav-user.svelte"]) {
      const original = fs.readFileSync(path.join(teamsDir, file), "utf8");
      const target = write(file, original);
      if (file === "nav-user.svelte") {
        modifyNavUser(target);
        unmodifyNavUser(target);
      } else {
        modifyAppLayoutServer(target, subsAppLayoutServer);
        unmodifyAppLayoutServer(target);
      }
      await expect(fs.readFileSync(target, "utf8")).toMatchFormatted(
        original,
        file,
      );
    }
  });

  it("leaves files without the subscription alone", () => {
    const target = write("+layout.server.ts", STOCK_LAYOUT_SERVER);
    expect(unmodifyAppLayoutServer(target)).toEqual({
      status: "success",
      changed: false,
    });
    const navUser = write("nav-user.svelte", strip(paymentsNavUserTemplate));
    expect(unmodifyNavUser(navUser)).toEqual({
      status: "success",
      changed: false,
    });
  });
});
