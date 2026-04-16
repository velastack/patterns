import path from "node:path";
import fs from "node:fs";
import { Options, Result, File } from "../../../core/types";
import {
  getMigrationFile,
  migrationDelay,
  withPocketbase,
} from "../../../runtime/pocketbase";

import { modifyLayoutServer } from "./modifies/+layout.server";
import { modifyRootLayoutSvelte } from "./modifies/root-layout.svelte";
import { modifyHooksServer } from "./modifies/hooks.server";

export async function generate(options: Options) {
  const { input } = options;

  let creates: File[] = [];

  // Update PocketBase
  await withPocketbase(options.root, async (pb) => {
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
      });
    }
  });

  // Modify files
  let modifies: File[] = [];

  const layoutServerFile = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );

  await modifyLayoutServer(layoutServerFile);
  modifies.push({
    path: layoutServerFile,
    language: "ts",
    content: fs.readFileSync(layoutServerFile, "utf8"),
  });

  // TODO: make this more robust by searching for Navbar.Root > Navbar.List
  // src/routes/(public)/root-layout.svelte is what vela creates by default
  let layoutFile = path.join(
    options.root,
    "src",
    "routes",
    "(public)",
    "root-layout.svelte",
  );

  if (!fs.existsSync(layoutFile)) {
    layoutFile = path.join(options.root, "src", "routes", "root-layout.svelte");
  }

  if (!fs.existsSync(layoutFile)) {
    layoutFile = path.join(
      options.root,
      "src",
      "routes",
      "(public)",
      "+layout.svelte",
    );
  }

  if (!fs.existsSync(layoutFile)) {
    layoutFile = path.join(options.root, "src", "routes", "+layout.svelte");
  }

  if (fs.existsSync(layoutFile)) {
    modifyRootLayoutSvelte(layoutFile);
    modifies.push({
      path: layoutFile,
      language: "svelte",
      content: fs.readFileSync(layoutFile, "utf8"),
    });
  }

  const hooksServerFile = path.join(options.root, "src", "hooks.server.ts");

  if (fs.existsSync(hooksServerFile)) {
    modifyHooksServer(hooksServerFile);
    modifies.push({
      path: hooksServerFile,
      language: "ts",
      content: fs.readFileSync(hooksServerFile, "utf8"),
    });
  }

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
  } satisfies Result;
}
