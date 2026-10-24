import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { languageFromPath } from "../../../core/util";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyWebhookServer } from "./modifies/modify-webhook-server";
import { addItemToNavUser } from "../payments/modifies/modify-nav-user";
import successServer from "./preview-modifies/src/routes/(public)/checkout/success/+page.server.ts?raw";
import successSvelte from "./preview-modifies/src/routes/(public)/checkout/success/+page.svelte?raw";

/** The success page, which enable-ecommerce wrote and this pattern rewrites to show the order. */
export const SUCCESS_PAGE = "src/routes/(public)/checkout/success";

const NAV_USER = path.join("src", "lib", "components", "nav-user.svelte");

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info(
    "Routing the Checkout Session events in webhooks/stripe/handlers/dispatch.ts",
  );
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
    modifyOutcomeToFile(dispatchPath, modifyWebhookServer(dispatchPath)),
  );

  // A rewrite rather than an edit: the page's load changes shape (the order
  // and its lines, then Stripe's summary as the fallback).
  logger.info("Showing the order on /checkout/success");
  for (const [name, content] of [
    ["+page.server.ts", successServer],
    ["+page.svelte", successSvelte],
  ] as const) {
    const file = path.join(options.root, SUCCESS_PAGE, name);
    if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content)
      continue;
    modifies.push({
      path: file,
      language: languageFromPath(file),
      content,
      status: "success",
    });
  }

  if (options.features.auth) {
    logger.info("Adding Orders to the user menu");
    const navUserPath = path.join(options.root, NAV_USER);
    if (fs.existsSync(navUserPath)) {
      const source = fs.readFileSync(navUserPath, "utf8");
      if (!source.includes("'/orders'")) {
        const { newNavUserSnippet, wasAdded } = addItemToNavUser(
          source,
          "Orders",
          "/orders",
          "PackageIcon",
          "@lucide/svelte/icons/package",
        );
        if (wasAdded) {
          fs.writeFileSync(navUserPath, newNavUserSnippet, "utf8");
          modifies.push({
            path: navUserPath,
            language: languageFromPath(navUserPath),
            content: newNavUserSnippet,
            status: "success",
          });
        } else {
          modifies.push({
            path: navUserPath,
            language: languageFromPath(navUserPath),
            content: source,
            status: "failed",
            message:
              "Add an Orders item to the navUser array in nav-user.svelte:\n\n" +
              "import PackageIcon from '@lucide/svelte/icons/package';\n" +
              "{ title: 'Orders', url: '/orders', icon: PackageIcon }",
          });
        }
      }
    }
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
