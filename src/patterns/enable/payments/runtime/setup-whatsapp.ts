import fs from "node:fs";
import type { Options, Result } from "../../../../core/types";
import { InvalidArgumentError } from "../../../../core/errors";
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

  return {
    creates: file && !existed ? [file] : [],
    modifies: file && existed ? [file] : [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
