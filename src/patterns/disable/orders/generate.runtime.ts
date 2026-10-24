import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { languageFromPath } from "../../../core/util";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { SvelteFile } from "../../../runtime/svelte-file";
import { removeNavItemFromScript } from "../../../runtime/ts-morph-helpers";
import { planDropsForCollections } from "../../destroy/shared";
import { ORDER_COLLECTIONS } from "../../enable/orders/generate";
import { SUCCESS_PAGE } from "../../enable/orders/generate.runtime";
import { unmodifyWebhookServer } from "../../enable/orders/modifies/modify-webhook-server";
// The success page as enable-ecommerce wrote it, before orders rewrote it.
import successServer from "../../enable/ecommerce/providers/stripe/src/routes/(public)/checkout/success/+page.server.ts?raw";
import successSvelte from "../../enable/ecommerce/providers/stripe/src/routes/(public)/checkout/success/+page.svelte?raw";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting webhooks/stripe/handlers/dispatch.ts");
  const dispatchPath = path.join(
    options.root,
    "src",
    "routes",
    "webhooks",
    "stripe",
    "handlers",
    "dispatch.ts",
  );
  pushResult(
    modifyOutcomeToFile(dispatchPath, unmodifyWebhookServer(dispatchPath)),
  );

  // Back to Stripe's summary alone, as enable-ecommerce wrote the page; a
  // project without the cart has no page to restore.
  logger.info("Reverting /checkout/success");
  for (const [name, content] of [
    ["+page.server.ts", successServer],
    ["+page.svelte", successSvelte],
  ] as const) {
    const file = path.join(options.root, SUCCESS_PAGE, name);
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") === content) {
      continue;
    }
    modifies.push({
      path: file,
      language: languageFromPath(file),
      content,
      status: "success",
    });
  }

  logger.info("Removing Orders from the user menu");
  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  if (fs.existsSync(navUserPath)) {
    const source = fs.readFileSync(navUserPath, "utf8");
    if (source.includes("'/orders'")) {
      const file = new SvelteFile(source);
      let removed = false;
      const tryRemove = (run: (fn: (s: string) => string) => boolean) => {
        if (removed) return;
        run((src) => {
          const result = removeNavItemFromScript(
            src,
            "Orders",
            "@lucide/svelte/icons/package",
          );
          if (result.wasRemoved) removed = true;
          return result.source;
        });
      };
      tryRemove((fn) => file.modifyModuleScript(fn));
      if (!removed) tryRemove((fn) => file.modifyScript(fn));
      if (removed) {
        const updated = file.toString();
        fs.writeFileSync(navUserPath, updated, "utf8");
        modifies.push({
          path: navUserPath,
          language: languageFromPath(navUserPath),
          content: updated,
          status: "success",
        });
      }
    }
  }

  // Lines before orders: PocketBase refuses to drop a collection another
  // relation still points at. One never created is planned as missing.
  const collectionDrops = await planDropsForCollections(
    [...ORDER_COLLECTIONS].reverse(),
    options,
  );

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops,
  } satisfies Result;
}
