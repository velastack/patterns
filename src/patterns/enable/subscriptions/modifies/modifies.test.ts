import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../../../../core/test-utils";
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
const strip = (source: string) =>
  source
    .replace(/^[ \t]*\/\/[ \t]*\[!code highlight:\d+\][ \t]*\r?\n/gm, "")
    .replace(
      /^[ \t]*<!--[ \t]*\[!code highlight:\d+\][ \t]*-->[ \t]*\r?\n/gm,
      "",
    );

/** The (app) layout load the velastack-auth baseline ships. */
const STOCK_LAYOUT_SERVER = `export const load = ({ locals }) => {
\tconst user = locals.pb.authStore.record!;
\tconst breadcrumbs = [{ title: 'Home', url: '/dashboard' }];

\treturn { user, breadcrumbs };
};
`;
const paymentsNavUser = strip(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../payments/preview-modifies/src/lib/components/nav-user.svelte",
    ),
    "utf8",
  ),
);
const teamsLayoutServer = fs.readFileSync(
  path.join(
    __dirname,
    "../../teams/modifies/fixtures/expect/+layout.server.ts",
  ),
  "utf8",
);
const teamsNavUser = fs.readFileSync(
  path.join(__dirname, "../../teams/modifies/fixtures/expect/nav-user.svelte"),
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
    file: "dispatch.ts",
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

describe("subscriptions modifies (files other patterns edit too)", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const write = (file: string, content: string) => {
    const target = path.join(tempDir, file);
    fs.writeFileSync(target, content, "utf8");
    return target;
  };

  it("adds the subscription to the stock layout load, as the preview shows", async () => {
    const target = write("+layout.server.ts", STOCK_LAYOUT_SERVER);
    expect(modifyAppLayoutServer(target, appLayoutServerTemplate)).toEqual({
      status: "success",
      changed: true,
    });
    await expect(fs.readFileSync(target, "utf8")).toMatchFormatted(
      strip(appLayoutServerTemplate),
      "+layout.server.ts",
    );
  });

  it("keeps the team data enable-teams put in the layout load", () => {
    const target = write("+layout.server.ts", teamsLayoutServer);
    expect(modifyAppLayoutServer(target, appLayoutServerTemplate).status).toBe(
      "success",
    );
    const content = fs.readFileSync(target, "utf8");
    expect(content).toContain("const teams = await");
    expect(content).toMatch(/team,\s*teams,\s*subscription/);
    expect(content).toContain(
      "const subscription = await loadActiveSubscription(locals, user.id);",
    );
    expect(content).toContain("async function loadActiveSubscription");
  });

  it("adds the plan label to the stock nav-user, as the preview shows", async () => {
    const target = write("nav-user.svelte", paymentsNavUser);
    expect(modifyNavUser(target)).toEqual({ status: "success", changed: true });
    await expect(fs.readFileSync(target, "utf8")).toMatchFormatted(
      strip(navUserTemplate),
      "nav-user.svelte",
    );
  });

  it("keeps the menu items other patterns added to nav-user", () => {
    const target = write("nav-user.svelte", teamsNavUser);
    expect(modifyNavUser(target).status).toBe("success");
    const content = fs.readFileSync(target, "utf8");
    expect(content).toContain("title: 'Teams'");
    expect(content.match(/\{planLabel\}/g)).toHaveLength(2);
  });

  it("is idempotent", () => {
    const layout = write("+layout.server.ts", teamsLayoutServer);
    const navUser = write("nav-user.svelte", teamsNavUser);
    modifyAppLayoutServer(layout, appLayoutServerTemplate);
    modifyNavUser(navUser);
    const before = [layout, navUser].map((f) => fs.readFileSync(f, "utf8"));
    expect(modifyAppLayoutServer(layout, appLayoutServerTemplate)).toEqual({
      status: "success",
      changed: false,
    });
    expect(modifyNavUser(navUser)).toEqual({
      status: "success",
      changed: false,
    });
    expect([layout, navUser].map((f) => fs.readFileSync(f, "utf8"))).toEqual(
      before,
    );
  });

  it("leaves a load it does not recognise alone", () => {
    const content = "export const load = () => ({ title: 'x' });\n";
    const target = write("+layout.server.ts", content);
    expect(modifyAppLayoutServer(target, appLayoutServerTemplate).status).toBe(
      "failed",
    );
    expect(fs.readFileSync(target, "utf8")).toBe(content);
  });

  it("reports not-found when targets are missing", () => {
    const missing = path.join(tempDir, "does-not-exist");
    expect(modifyAppLayoutServer(missing, appLayoutServerTemplate).status).toBe(
      "not-found",
    );
    expect(modifyNavUser(missing).status).toBe("not-found");
  });
});
