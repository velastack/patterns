import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { getLogger } from "../../../core/logger";
import { ADAPTER_STATIC as ADAPTER_STATIC_SPEC } from "../../../core/constants";
import {
  providerEnvVars,
  resolveProvider,
  suppliedProviderEnv,
} from "../../../core/providers";
import { resolveConfigTarget } from "../../../runtime/config-target";
import { modifyEnv } from "../../../runtime/env";
import { modifyEnvVarsFiles } from "../../../runtime/env-vars";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { packageName } from "../../../runtime/write-result";
import { envEditsFor, META } from "./generate";

// The config imports the package, not the versioned spec the constant installs.
const ADAPTER_STATIC = packageName(ADAPTER_STATIC_SPEC);

export const STATIC_ADAPTER_MESSAGE = [
  `AI needs a server, and this project builds with ${ADAPTER_STATIC}.`,
  "The chat endpoint streams each reply from the server with a private API key, which a static site cannot do.",
  "Switch to a server adapter first: `vela enable backend` moves the project to @sveltejs/adapter-node.",
].join("\n");

/**
 * Whether the SvelteKit config the project builds with imports
 * adapter-static. A config that cannot be resolved does not count: the
 * pattern only refuses what it can see.
 */
export function usesStaticAdapter(root: string): boolean {
  const res = resolveConfigTarget(root);
  if (res.status !== "resolved") return false;
  return res.target.sourceFile
    .getImportDeclarations()
    .some((decl) => decl.getModuleSpecifierValue() === ADAPTER_STATIC);
}

export async function generate(options: Options) {
  if (usesStaticAdapter(options.root)) {
    throw new InvalidArgumentError(STATIC_ADAPTER_MESSAGE);
  }

  const logger = getLogger(options);
  const provider = resolveProvider(META, options);
  const creates: File[] = [];
  const modifies: File[] = [];

  // SvelteKit 3 exposes only declared variables: `src/lib/server/ai.ts`
  // imports the provider's key from `$app/env/private`.
  logger.info("Declaring the API key in src/env.ts");
  const envVars = modifyEnvVarsFiles(options.root, providerEnvVars(provider));
  if (envVars.create) creates.push(envVars.create);
  if (envVars.modify) modifies.push(envVars.modify);

  logger.info("Updating .env");
  const envPath = path.join(options.root, ".env");
  const envFile = modifyOutcomeToFile(
    envPath,
    modifyEnv(envPath, envEditsFor(provider, suppliedProviderEnv(options))),
  );
  if (envFile) modifies.push(envFile);

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
