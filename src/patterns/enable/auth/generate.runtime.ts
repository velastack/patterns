import path from "node:path";
import fs from "node:fs";
import { Options, Result, File } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import {
  getMigrationFile,
  migrationDelay,
  withPocketbase,
} from "../../../runtime/pocketbase";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";

import { modifyLayoutServer } from "./modifies/+layout.server";
import { modifyRootLayoutSvelte } from "./modifies/root-layout.svelte";
import { modifyHooksServer } from "./modifies/hooks.server";
import { modifySidebarMenuButton } from "./modifies/sidebar-menu-button.svelte";

export async function generate(options: Options) {
  const { input } = options;
  const logger = getLogger(options);

  let creates: File[] = [];

  // Update PocketBase
  await withPocketbase(options.root, async (pb) => {
    logger.info("Updating PocketBase mail settings");
    await pb.settings.update({
      meta: {
        senderName: input.senderName,
        senderAddress: input.senderAddress,
      },
    });
    await migrationDelay();

    const userCollection = await pb.collections.getOne("users");

    if (!userCollection) {
      throw new Error("Users collection not found");
    }

    const verificationTemplate =
      userCollection.verificationTemplate.body.replace(
        "{APP_URL}/_/#/auth/confirm-verification/{TOKEN}",
        "{APP_URL}/confirm-verification/{TOKEN}",
      );
    const resetPasswordTemplate =
      userCollection.resetPasswordTemplate.body.replace(
        "{APP_URL}/_/#/auth/confirm-reset/{TOKEN}",
        "{APP_URL}/confirm-reset/{TOKEN}",
      );
    const confirmEmailChangeTemplate =
      userCollection.confirmEmailChangeTemplate.body.replace(
        "{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}",
        "{APP_URL}/confirm-email-change/{TOKEN}",
      );

    logger.info("Locking down users collection rules and email templates");
    // Update user auth rules to lock down access to the user's own account
    await pb.collections.update("users", {
      listRule: "@request.auth.id = id",
      viewRule: "@request.auth.id = id",
      createRule: "@request.auth.id = id",
      updateRule: "@request.auth.id = id",
      deleteRule: "@request.auth.id = id",

      // Update email templates to VelaStack auth urls
      verificationTemplate: {
        body: verificationTemplate,
      },
      resetPasswordTemplate: {
        body: resetPasswordTemplate,
      },
      confirmEmailChangeTemplate: {
        body: confirmEmailChangeTemplate,
      },
    });
    await migrationDelay();

    const migrationFile = getMigrationFile("users", "updated", options);
    if (migrationFile) {
      creates.push({
        path: migrationFile,
        language: "ts",
        content: fs.readFileSync(migrationFile, "utf8"),
        status: "success",
      });
    }
  });

  // Modify files
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying +layout.server.ts");
  const layoutServerFile = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );
  pushResult(
    modifyOutcomeToFile(layoutServerFile, modifyLayoutServer(layoutServerFile)),
  );

  logger.info("Modifying root layout");
  // TODO: make this more robust by searching for Navbar.Root > Navbar.List
  // src/routes/(public)/root-layout.svelte is what vela creates by default
  const layoutCandidates = [
    path.join(options.root, "src", "routes", "(public)", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "root-layout.svelte"),
    path.join(options.root, "src", "routes", "(public)", "+layout.svelte"),
    path.join(options.root, "src", "routes", "+layout.svelte"),
  ];
  const layoutFile =
    layoutCandidates.find((p) => fs.existsSync(p)) ?? layoutCandidates[0];
  pushResult(
    modifyOutcomeToFile(layoutFile, modifyRootLayoutSvelte(layoutFile)),
  );

  logger.info("Modifying hooks.server.ts");
  const hooksServerFile = path.join(options.root, "src", "hooks.server.ts");
  pushResult(
    modifyOutcomeToFile(hooksServerFile, modifyHooksServer(hooksServerFile)),
  );

  logger.info("Modifying sidebar-menu-button.svelte");
  const sidebarMenuButtonFile = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "ui",
    "sidebar",
    "sidebar-menu-button.svelte",
  );
  pushResult(
    modifyOutcomeToFile(
      sidebarMenuButtonFile,
      modifySidebarMenuButton(sidebarMenuButtonFile),
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
