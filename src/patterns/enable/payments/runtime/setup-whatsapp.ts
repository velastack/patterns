import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../../core/types";
import { InvalidArgumentError } from "../../../../core/errors";
import { getLogger } from "../../../../core/logger";
import { modifyOutcomeToFile } from "../../../../runtime/modify-file";
import type { SiteBusiness } from "../../../../runtime/site";
import {
  modifyWuchaleJsFiles,
  TRANSLATED_LIB_FILES,
} from "../../../../runtime/wuchale-config";

/**
 * WhatsApp keeps nothing past the env: orders go to the business's chat, and
 * the hosted form they are recorded to is created by the CLI. Every price is
 * in `site.currency`, so a project without one can't take orders: `business`
 * is what `src/lib/site.ts` declares after the shared step wrote it.
 */
export async function setupWhatsApp(options: Options, business: SiteBusiness) {
  if (!business.currency) {
    const given = options.input.currency;
    throw new InvalidArgumentError(
      given === undefined || given === ""
        ? "Payments on WhatsApp need the business's currency, the one it prices in (an ISO 4217 code such as MXN or EUR). Pass --currency, or set `currency` in src/lib/site.ts."
        : `${String(given)} is not an ISO 4217 currency code, such as MXN or EUR.`,
    );
  }
  const modifies: File[] = [];

  // The order message is text a visitor sends, so with wuchale on it is
  // translated like the pages: the js adapter has to be told about the module.
  const wuchaleConfig = path.join(options.root, "wuchale.config.js");
  if (fs.existsSync(wuchaleConfig)) {
    getLogger(options).info("Adding src/lib/order.ts to wuchale's js adapter");
    const edit = modifyOutcomeToFile(
      wuchaleConfig,
      modifyWuchaleJsFiles(wuchaleConfig, TRANSLATED_LIB_FILES),
    );
    if (edit) modifies.push(edit);
  }

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
