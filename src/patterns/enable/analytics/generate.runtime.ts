import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import {
  providerEnvVars,
  resolveProvider,
  suppliedProviderEnv,
} from "../../../core/providers";
import { modifyEnvVarsFiles } from "../../../runtime/env-vars";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyEnv } from "../../../runtime/env";
import { envEditsFor, META } from "./generate";
import { modifyLayoutSvelte } from "./modifies/layout.svelte";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const provider = resolveProvider(META, options);
  const creates: File[] = [];
  const modifies: File[] = [];

  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying src/routes/+layout.svelte");
  const layoutPath = path.join(options.root, "src", "routes", "+layout.svelte");
  pushResult(modifyOutcomeToFile(layoutPath, modifyLayoutSvelte(layoutPath)));

  // SvelteKit 3 exposes only declared variables, and only `public: true`
  // ones through `$app/env/public`, where the component imports them.
  logger.info("Declaring the analytics variables in src/env.ts");
  const envVars = modifyEnvVarsFiles(options.root, providerEnvVars(provider));
  if (envVars.create) creates.push(envVars.create);
  pushResult(envVars.modify);

  logger.info("Updating .env");
  const envPath = path.join(options.root, ".env");
  pushResult(
    modifyOutcomeToFile(
      envPath,
      modifyEnv(envPath, envEditsFor(provider, suppliedProviderEnv(options))),
    ),
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
