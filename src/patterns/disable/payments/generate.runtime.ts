import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyEnvRemove } from "../../../runtime/env";
import { unmodifyEnvVarsFiles } from "../../../runtime/env-vars";
import { envEditsFor } from "../../enable/payments/generate";
import { providersToRemove } from "./generate";
import { unmodifyNavUser } from "./modifies/modify-nav-user";
import { unmodifyHooksServerCurrency } from "../../enable/payments/modifies/hooks.server";
import { unmodifyLayoutServerCurrency } from "../../enable/payments/modifies/layout.server";
import { unmodifyLayoutSvelteCurrency } from "../../enable/payments/modifies/layout.svelte";
import { unmodifyRootLayoutCurrencySelect } from "../../enable/payments/modifies/root-layout.svelte";
import { unmodifyUserSignup } from "./modifies/modify-user-signup";
import { planDropsForCollections } from "../../destroy/shared";
import fs from "node:fs";
import {
  modifyWuchaleJsFiles,
  TRANSLATED_LIB_FILES,
} from "../../../runtime/wuchale-config";

/** Everything enable-payments creates in PocketBase for Stripe. */
const STRIPE_COLLECTIONS = [
  "transactions",
  "stripe_customers",
  "stripe_payment_methods",
  "stripe_prices",
  "stripe_products",
];

export async function generate(options: Options) {
  const isAppMode = options.features.auth;
  const logger = getLogger(options);
  const providers = providersToRemove(options);
  const isStripe = providers.some((provider) => provider.id === "stripe");
  const modifies: File[] = [];
  const deletes: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  const envPath = path.join(options.root, ".env");
  for (const provider of providers) {
    logger.info(`Stripping ${provider.label} credentials from .env`);
    pushResult(
      modifyOutcomeToFile(
        envPath,
        modifyEnvRemove(envPath, envEditsFor(provider)),
      ),
    );
  }

  logger.info("Removing the currency select from the navbar");
  const layoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(public)",
    "root-layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(
      layoutPath,
      unmodifyRootLayoutCurrencySelect(layoutPath),
    ),
  );

  // The server half of the store, where enable-payments added it.
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );
  const rootLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.svelte",
  );
  if (fs.existsSync(layoutServerPath)) {
    logger.info("Removing the visitor's currency from the server");
    pushResult(
      modifyOutcomeToFile(
        rootLayoutPath,
        unmodifyLayoutSvelteCurrency(rootLayoutPath),
      ),
    );
    pushResult(
      modifyOutcomeToFile(
        layoutServerPath,
        unmodifyLayoutServerCurrency(layoutServerPath),
      ),
    );
    pushResult(
      modifyOutcomeToFile(
        hooksServerPath,
        unmodifyHooksServerCurrency(hooksServerPath),
      ),
    );
  }

  logger.info("Removing payment variables from src/env.ts");
  const envVars = unmodifyEnvVarsFiles(
    options.root,
    providers.flatMap((provider) =>
      (provider.env ?? []).map((variable) => variable.key),
    ),
  );
  pushResult(envVars.modify);
  if (envVars.delete) deletes.push(envVars.delete);

  // WhatsApp's order message was listed for wuchale; the module goes, so the
  // entry does too.
  const wuchaleConfig = path.join(options.root, "wuchale.config.js");
  if (
    providers.some((provider) => provider.id === "whatsapp") &&
    fs.existsSync(wuchaleConfig)
  ) {
    logger.info("Removing src/lib/order.ts from wuchale's js adapter");
    pushResult(
      modifyOutcomeToFile(
        wuchaleConfig,
        modifyWuchaleJsFiles(wuchaleConfig, TRANSLATED_LIB_FILES, "remove"),
      ),
    );
  }

  // The nav item and the signup link exist only in auth's files, which
  // enable-payments edits for Stripe alone.
  if (isStripe && isAppMode) {
    logger.info("Reverting nav-user.svelte");
    const navUserPath = path.join(
      options.root,
      "src",
      "lib",
      "components",
      "nav-user.svelte",
    );
    pushResult(modifyOutcomeToFile(navUserPath, unmodifyNavUser(navUserPath)));

    logger.info("Reverting signup +page.server.ts");
    const userSignupPath = path.join(
      options.root,
      "src",
      "routes",
      "(public)",
      "(auth)",
      "signup",
      "+page.server.ts",
    );
    pushResult(
      modifyOutcomeToFile(userSignupPath, unmodifyUserSignup(userSignupPath)),
    );
  }

  // Every Stripe collection is planned, whatever auth is now; one that was
  // never created is planned as missing and left alone. Without a backend
  // (no provider detected, on a Shopify project) there is nothing to drop.
  const collectionDrops =
    isStripe && options.features.backend
      ? await planDropsForCollections(STRIPE_COLLECTIONS, options)
      : [];

  return {
    creates: [],
    modifies,
    deletes,
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops,
  } satisfies Result;
}
