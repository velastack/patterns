import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyEnvRemove, type EnvEdit } from "../../../runtime/env";
import { unmodifyNavUser } from "./modifies/modify-nav-user";
import { unmodifyUserSignup } from "./modifies/modify-user-signup";
import { planDropsForCollections } from "../../destroy/shared";

export async function generate(options: Options) {
  const isAppMode = options.features.auth;
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Stripping Stripe credentials from .env");
  const envEdits: EnvEdit[] = [
    { type: "comment", key: "Stripe credentials" },
    { type: "var", key: "STRIPE_SECRET_KEY" },
    { type: "var", key: "PUBLIC_STRIPE_PUBLISHABLE_KEY" },
    { type: "var", key: "STRIPE_WEBHOOK_SECRET" },
    { type: "var", key: "INTERNAL_JOB_SECRET" },
  ];
  const envPath = path.join(options.root, ".env");
  pushResult(modifyOutcomeToFile(envPath, modifyEnvRemove(envPath, envEdits)));

  if (isAppMode) {
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
      "signup",
      "+page.server.ts",
    );
    pushResult(
      modifyOutcomeToFile(userSignupPath, unmodifyUserSignup(userSignupPath)),
    );
  }

  const collectionNames = [
    "transactions",
    "stripe_payment_methods",
    "stripe_customers",
    "stripe_prices",
    "stripe_products",
  ];
  const collectionDrops = await planDropsForCollections(
    isAppMode ? collectionNames : ["stripe_prices", "stripe_products"],
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
