import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import {
  getMigrationFile,
  migrationDelay,
  withPocketbase,
} from "../../../runtime/pocketbase";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import {
  MIN_POCKETBASE_SERVER,
  enableWhatsAppAuth,
  hasWhatsAppPlugin,
  setupWhatsAppFields,
  writeWhatsAppConfigMigration,
} from "./runtime/whatsapp";
import { swapAuthPages } from "./modifies/auth-pages";
import { modifyTestSetup } from "./modifies/modify-test-setup";

export const DOCS_URL = "https://docs.velastack.dev/enable/whatsapp";

function migrationCreate(file: string): File {
  return {
    path: file,
    language: "js",
    content: fs.readFileSync(file, "utf8"),
    status: "success",
  };
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const creates: File[] = [];

  await withPocketbase(options.root, async (pb) => {
    if (!(await hasWhatsAppPlugin(pb))) {
      throw new Error(
        `This PocketBase has no WhatsApp sign-in. It comes with pocketbase-server ${MIN_POCKETBASE_SERVER} and later: run \`npm install -D pocketbase-server@^${MIN_POCKETBASE_SERVER}\`, then \`vela enable whatsapp\` again.`,
      );
    }

    logger.info("Adding the phone fields to users and making email optional");
    if (await setupWhatsAppFields(pb)) {
      await migrationDelay();
      const file = getMigrationFile("users", "updated", options);
      if (file) creates.push(migrationCreate(file));
    }

    logger.info("Turning on WhatsApp sign-in for users");
    await enableWhatsAppAuth(pb);
    await migrationDelay();
    const configMigration = writeWhatsAppConfigMigration(options, true);
    if (configMigration) creates.push(migrationCreate(configMigration));
  });

  logger.info("Adding WhatsApp to the login and signup pages");
  const modifies: File[] = [];
  const outcomes = await swapAuthPages(
    options.root,
    "enable",
    (filePath) =>
      `${path.relative(options.root, filePath)} is not the page enable-auth wrote, so it was left as it is. Add the WhatsApp option to it by hand: ${DOCS_URL}`,
  );
  for (const [filePath, outcome] of outcomes) {
    const file = modifyOutcomeToFile(filePath, outcome);
    if (file) modifies.push(file);
  }

  logger.info("Updating test/setup.ts for an optional email");
  const testSetup = path.join(options.root, "test", "setup.ts");
  const testSetupFile = modifyOutcomeToFile(
    testSetup,
    modifyTestSetup(testSetup),
  );
  if (testSetupFile) modifies.push(testSetupFile);

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
