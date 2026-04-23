import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { planDropsForCollections } from "../../destroy/shared";
import { unmodifyStripeHooks } from "./modifies/modify-stripe-hooks";
import { unmodifyWebhookServer } from "./modifies/modify-webhook-server";
import { unmodifyAppLayoutSvelte } from "./modifies/modify-app-layout-svelte";
import { unmodifyAppSidebar } from "./modifies/modify-app-sidebar";
import { unmodifyAppLayoutServer } from "./modifies/modify-app-layout-server";
import { unmodifyNavUser } from "./modifies/modify-nav-user";
import { unmodifyBillingPageServer } from "./modifies/modify-billing-page-server";
import { unmodifyBillingPageSvelte } from "./modifies/modify-billing-page-svelte";

// Pull the "post-payments" state of files that enable-subscriptions fully
// overwrote. For the billing pages, that's exactly what enable-payments
// writes in creates-app-mode; for nav-user it's the payments preview-modifies
// snapshot (with highlight annotations stripped by the revert helper).
import paymentsNavUserTemplate from "../../enable/payments/preview-modifies/src/lib/components/nav-user.svelte?raw";
import paymentsBillingPageServerTemplate from "../../enable/payments/creates-app-mode/src/routes/(app)/billing/+page.server.ts?raw";
import paymentsBillingPageSvelteTemplate from "../../enable/payments/creates-app-mode/src/routes/(app)/billing/+page.svelte?raw";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting data/hooks/stripe.pb.js");
  const stripeHooksPath = path.join(
    options.root,
    "data",
    "hooks",
    "stripe.pb.js",
  );
  pushResult(
    modifyOutcomeToFile(stripeHooksPath, unmodifyStripeHooks(stripeHooksPath)),
  );

  logger.info("Reverting webhooks/stripe/+server.ts");
  const webhookServerPath = path.join(
    options.root,
    "src",
    "routes",
    "webhooks",
    "stripe",
    "+server.ts",
  );
  pushResult(
    modifyOutcomeToFile(
      webhookServerPath,
      unmodifyWebhookServer(webhookServerPath),
    ),
  );

  logger.info("Reverting (app)/+layout.server.ts");
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
      unmodifyAppLayoutServer(appLayoutServerPath),
    ),
  );

  logger.info("Reverting (app)/+layout.svelte");
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
      unmodifyAppLayoutSvelte(appLayoutSveltePath),
    ),
  );

  logger.info("Reverting app-sidebar.svelte");
  const appSidebarPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "app-sidebar.svelte",
  );
  pushResult(
    modifyOutcomeToFile(appSidebarPath, unmodifyAppSidebar(appSidebarPath)),
  );

  logger.info("Reverting nav-user.svelte");
  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  pushResult(
    modifyOutcomeToFile(
      navUserPath,
      unmodifyNavUser(navUserPath, paymentsNavUserTemplate),
    ),
  );

  logger.info("Reverting billing/+page.server.ts");
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
      unmodifyBillingPageServer(
        billingPageServerPath,
        paymentsBillingPageServerTemplate,
      ),
    ),
  );

  logger.info("Reverting billing/+page.svelte");
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
      unmodifyBillingPageSvelte(
        billingPageSveltePath,
        paymentsBillingPageSvelteTemplate,
      ),
    ),
  );

  const collectionDrops = await planDropsForCollections(
    ["stripe_subscriptions"],
    options,
  );

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops,
  } satisfies Result;
}
