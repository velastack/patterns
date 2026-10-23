import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../../core/types";
import { InvalidArgumentError } from "../../../../core/errors";
import { getLogger } from "../../../../core/logger";
import { modifyOutcomeToFile } from "../../../../runtime/modify-file";
import {
  modifyWuchaleJsFiles,
  TRANSLATED_LIB_FILES,
} from "../../../../runtime/wuchale-config";
import {
  ensureSiteCurrency,
  normalizeCurrency,
  siteCurrency,
  sitePath,
} from "../../../../runtime/site";

/**
 * WhatsApp keeps nothing past the env and the business's currency: orders go
 * to the business's chat, and the hosted form they are recorded to is
 * created by the CLI. Every price is in `site.currency`, the currency the
 * business quotes in, so it is written once into `src/lib/site.ts`.
 */
export async function setupWhatsApp(options: Options) {
  const given = options.input.currency;
  const currency = normalizeCurrency(given) ?? siteCurrency(options.root);
  if (!currency) {
    throw new InvalidArgumentError(
      given === undefined || given === ""
        ? "Payments on WhatsApp need the business's currency, the one it prices in (an ISO 4217 code such as MXN or EUR). Pass --currency, or set `currency` in src/lib/site.ts."
        : `${String(given)} is not an ISO 4217 currency code, such as MXN or EUR.`,
    );
  }
  const existed = fs.existsSync(sitePath(options.root));
  const { file } = await ensureSiteCurrency(options, currency);
  const modifies: File[] = file && existed ? [file] : [];

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
    creates: file && !existed ? [file] : [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
