import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import {
  providerEnvVars,
  resolveProvider,
  suppliedProviderEnv,
} from "../../../core/providers";
import { mergeResults } from "../../../core/util";
import { modifyEnvVarsFiles } from "../../../runtime/env-vars";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyEnv } from "../../../runtime/env";
import {
  ensureSiteBusiness,
  normalizeCountry,
  normalizeCurrencies,
  normalizeCurrency,
  sitePath,
} from "../../../runtime/site";
import { envEditsFor, META } from "./generate";
import { modifyRootLayoutCurrencySelect } from "./modifies/root-layout.svelte";
import { setupShopify } from "./runtime/setup-shopify";
import { setupStripe } from "./runtime/setup-stripe";
import { setupWhatsApp } from "./runtime/setup-whatsapp";

/** Whether the project can run a unit test (`vitest` in package.json). */
export function hasVitest(root: string): boolean {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Boolean(pkg.devDependencies?.vitest || pkg.dependencies?.vitest);
  } catch {
    return false;
  }
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const provider = resolveProvider(META, options);
  const creates: File[] = [];
  const modifies: File[] = [];

  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info(`Writing ${provider.label} credentials to .env`);
  const envPath = path.join(options.root, ".env");
  pushResult(
    modifyOutcomeToFile(
      envPath,
      modifyEnv(envPath, envEditsFor(provider, suppliedProviderEnv(options))),
    ),
  );

  // SvelteKit 3 exposes only declared variables, and only `public: true`
  // ones through `$app/env/public`.
  logger.info(`Declaring ${provider.label} variables in src/env.ts`);
  const envVars = modifyEnvVarsFiles(options.root, providerEnvVars(provider));
  if (envVars.create) creates.push(envVars.create);
  pushResult(envVars.modify);

  // What the business declares in src/lib/site.ts: the currency it prices
  // in, the country it is in, and the other currencies it shows prices in.
  // Asked for by the CLI; a value already there is kept.
  const { currency, country, currencies } = options.input;
  const siteExisted = fs.existsSync(sitePath(options.root));
  const { file: siteFile, business } = await ensureSiteBusiness(options, {
    currency: normalizeCurrency(currency) ?? undefined,
    country: normalizeCountry(country) ?? undefined,
    currencies:
      normalizeCurrencies(
        currencies,
        normalizeCurrency(currency) ?? undefined,
      ) ?? undefined,
  });
  if (siteFile) (siteExisted ? modifies : creates).push(siteFile);

  logger.info("Adding the currency select to the navbar");
  const layoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(public)",
    "root-layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(layoutPath, modifyRootLayoutCurrencySelect(layoutPath)),
  );

  const env: Result = {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  };

  const setup =
    provider.id === "stripe"
      ? await setupStripe(options)
      : provider.id === "shopify"
        ? await setupShopify(options)
        : await setupWhatsApp(options, business);

  return mergeResults([env, setup]) satisfies Result;
}
