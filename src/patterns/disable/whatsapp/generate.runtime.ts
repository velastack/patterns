import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { migrationDelay, withPocketbase } from "../../../runtime/pocketbase";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import {
  disableWhatsAppAuth,
  hasWhatsAppPlugin,
  writeWhatsAppConfigMigration,
} from "../../enable/whatsapp/runtime/whatsapp";
import { swapAuthPages } from "../../enable/whatsapp/modifies/auth-pages";

const DOCS_URL = "https://docs.velastack.dev/disable/whatsapp";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const creates: File[] = [];

  await withPocketbase(options.root, async (pb) => {
    // Without the plugin there is no WhatsApp sign-in to turn off.
    if (!(await hasWhatsAppPlugin(pb))) return;

    logger.info("Turning off WhatsApp sign-in for users");
    await disableWhatsAppAuth(pb);
    await migrationDelay();
    const file = writeWhatsAppConfigMigration(options, false);
    if (!file) return;
    creates.push({
      path: file,
      language: "js",
      content: fs.readFileSync(file, "utf8"),
      status: "success",
    });
  });
  logger.info(
    "Keeping the phone fields on users, and email optional: they hold your users' data",
  );

  logger.info("Taking WhatsApp off the login and signup pages");
  const modifies: File[] = [];
  const outcomes = await swapAuthPages(
    options.root,
    "disable",
    (filePath) =>
      `${path.relative(options.root, filePath)} is not the page enable-whatsapp wrote, so it was left as it is. Take the WhatsApp option out of it by hand: ${DOCS_URL}`,
  );
  for (const [filePath, outcome] of outcomes) {
    const file = modifyOutcomeToFile(filePath, outcome);
    if (file) modifies.push(file);
  }

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
