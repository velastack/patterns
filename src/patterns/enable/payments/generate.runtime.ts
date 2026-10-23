import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import {
  providerEnvVars,
  resolveProvider,
  suppliedProviderEnv,
} from "../../../core/providers";
import { filesFromGlob, mergeResults } from "../../../core/util";
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
import { modifyHooksServerCurrency } from "./modifies/hooks.server";
import { modifyLayoutServerCurrency } from "./modifies/layout.server";
import { modifyLayoutSvelteCurrency } from "./modifies/layout.svelte";
import { modifyRootLayoutCurrencySelect } from "./modifies/root-layout.svelte";
import { setupShopify } from "./runtime/setup-shopify";
import { setupStripe } from "./runtime/setup-stripe";
import { setupWhatsApp } from "./runtime/setup-whatsapp";

const createsServerRaw = import.meta.glob<string>("./creates-server/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** The server half of the currency store, for a project with a server load. */
export function serverCreates(unitTests: boolean): File[] {
  return Object.values(filesFromGlob(createsServerRaw, "./creates-server/"))
    .filter((file) => unitTests || !file.path.endsWith(".test.ts"))
    .sort((a, b) => a.path.localeCompare(b.path));
}

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

  // With a server, the visitor's currency is decided per request and the
  // first render already shows it. A static site (a universal root load) keeps
  // the store's browser-side start.
  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );
  if (fs.existsSync(layoutServerPath)) {
    logger.info("Resolving the visitor's currency on the server");
    const layoutServer = modifyLayoutServerCurrency(layoutServerPath);
    pushResult(modifyOutcomeToFile(layoutServerPath, layoutServer));
    if (layoutServer.status === "success") {
      const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
      pushResult(
        modifyOutcomeToFile(
          hooksServerPath,
          modifyHooksServerCurrency(hooksServerPath),
        ),
      );
      const rootLayoutPath = path.join(
        options.root,
        "src",
        "routes",
        "+layout.svelte",
      );
      pushResult(
        modifyOutcomeToFile(
          rootLayoutPath,
          modifyLayoutSvelteCurrency(rootLayoutPath),
        ),
      );
      for (const file of serverCreates(hasVitest(options.root)))
        creates.push(file);
    }
  }

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
