import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { resolveProvider } from "../../../core/providers";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyEnv } from "../../../runtime/env";
import { envEditsFor, META } from "./generate";
import { modifyLayoutSvelte } from "./modifies/layout.svelte";

function suppliedEnv(options: Options): Record<string, string> {
  const raw = options.input.providerEnv;
  if (!raw || typeof raw !== "object") return {};
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const provider = resolveProvider(META, options);
  const modifies: File[] = [];

  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying src/routes/+layout.svelte");
  const layoutPath = path.join(options.root, "src", "routes", "+layout.svelte");
  pushResult(modifyOutcomeToFile(layoutPath, modifyLayoutSvelte(layoutPath)));

  logger.info("Updating .env");
  const envPath = path.join(options.root, ".env");
  pushResult(
    modifyOutcomeToFile(
      envPath,
      modifyEnv(envPath, envEditsFor(provider, suppliedEnv(options))),
    ),
  );

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
