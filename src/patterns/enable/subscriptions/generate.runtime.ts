import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { keepMissing, modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyWebhookServer } from "./modifies/modify-webhook-server";
import { modifyAppLayoutServer } from "./modifies/modify-app-layout-server";
import { modifyAppLayoutSvelte } from "./modifies/modify-app-layout-svelte";
import { modifyAppSidebar } from "./modifies/modify-app-sidebar";
import { modifyNavUser } from "./modifies/modify-nav-user";
import { modifyBillingPageServer } from "./modifies/modify-billing-page-server";
import { modifyBillingPageSvelte } from "./modifies/modify-billing-page-svelte";
import stripeCustomerHelper from "../payments/creates-app-mode/src/lib/server/stripe-customer.ts?raw";

// The billing page imports this payments helper, which apps that enabled
// payments before it existed do not have yet.
const STRIPE_CUSTOMER_HELPER = "src/lib/server/stripe-customer.ts";

// Share the final-state files between preview (rendered as-is) and runtime
// (used as overwrite templates for modifies that amount to full rewrites).
const previewRaw = import.meta.glob<string>("./preview-modifies/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

function template(relativePath: string): string {
  const key = `./preview-modifies/${relativePath}`;
  const content = previewRaw[key];
  if (content === undefined) {
    throw new Error(
      `Missing template for ${relativePath} in subscriptions preview-modifies`,
    );
  }
  return content;
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying webhooks/stripe/handlers/dispatch.ts");
  const webhookServerPath = path.join(
    options.root,
    "src",
    "routes",
    "webhooks",
    "stripe",
    "handlers",
    "dispatch.ts",
  );
  pushResult(
    modifyOutcomeToFile(
      webhookServerPath,
      modifyWebhookServer(webhookServerPath),
    ),
  );

  logger.info("Modifying (app)/+layout.server.ts");
  const appLayoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.server.ts",
  );
  pushResult(
    modifyOutcomeToFile(
      appLayoutServerPath,
      modifyAppLayoutServer(
        appLayoutServerPath,
        template("src/routes/(app)/+layout.server.ts"),
      ),
    ),
  );

  logger.info("Modifying (app)/+layout.svelte");
  const appLayoutSveltePath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(
      appLayoutSveltePath,
      modifyAppLayoutSvelte(appLayoutSveltePath),
    ),
  );

  logger.info("Modifying app-sidebar.svelte");
  const appSidebarPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "app-sidebar.svelte",
  );
  pushResult(
    modifyOutcomeToFile(appSidebarPath, modifyAppSidebar(appSidebarPath)),
  );

  logger.info("Modifying nav-user.svelte");
  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  pushResult(modifyOutcomeToFile(navUserPath, modifyNavUser(navUserPath)));

  logger.info("Modifying billing/+page.server.ts");
  const billingPageServerPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "billing",
    "+page.server.ts",
  );
  pushResult(
    modifyOutcomeToFile(
      billingPageServerPath,
      modifyBillingPageServer(
        billingPageServerPath,
        template("src/routes/(app)/billing/+page.server.ts"),
      ),
    ),
  );

  logger.info("Modifying billing/+page.svelte");
  const billingPageSveltePath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "billing",
    "+page.svelte",
  );
  pushResult(
    modifyOutcomeToFile(
      billingPageSveltePath,
      modifyBillingPageSvelte(
        billingPageSveltePath,
        template("src/routes/(app)/billing/+page.svelte"),
      ),
    ),
  );

  const creates = keepMissing(
    [
      {
        path: STRIPE_CUSTOMER_HELPER,
        language: "ts",
        content: stripeCustomerHelper,
        status: "success",
      },
    ],
    options.root,
  );

  return {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
