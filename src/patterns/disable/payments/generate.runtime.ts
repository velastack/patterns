import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyEnvRemove, type EnvEdit } from "../../../runtime/env";
import { unmodifyEnvVarsFiles } from "../../../runtime/env-vars";
import { STRIPE_ENV_VAR_NAMES } from "../../enable/payments/runtime/env-vars";
import { unmodifyNavUser } from "./modifies/modify-nav-user";
import { unmodifyUserSignup } from "./modifies/modify-user-signup";
import { planDropsForCollections } from "../../destroy/shared";

export async function generate(options: Options) {
  const isAppMode = options.features.auth;
  const logger = getLogger(options);
  const modifies: File[] = [];
  const deletes: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Stripping Stripe credentials from .env");
  const envEdits: EnvEdit[] = [
    { type: "comment", key: "Stripe credentials" },
    { type: "var", key: "STRIPE_SECRET_KEY" },
    { type: "var", key: "PUBLIC_STRIPE_PUBLISHABLE_KEY" },
    { type: "var", key: "STRIPE_WEBHOOK_SECRET" },
  ];
  const envPath = path.join(options.root, ".env");
  pushResult(modifyOutcomeToFile(envPath, modifyEnvRemove(envPath, envEdits)));

  logger.info("Removing Stripe variables from src/env.ts");
  const envVars = unmodifyEnvVarsFiles(options.root, STRIPE_ENV_VAR_NAMES);
  pushResult(envVars.modify);
  if (envVars.delete) deletes.push(envVars.delete);

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
      "(auth)",
      "signup",
      "+page.server.ts",
    );
    pushResult(
      modifyOutcomeToFile(userSignupPath, unmodifyUserSignup(userSignupPath)),
    );
  }

  const collectionNames = [
    "transactions",
    "stripe_customers",
    "stripe_payment_methods",
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
    deletes,
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops,
  } satisfies Result;
}
