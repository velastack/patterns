import path from "node:path";
import fs from "node:fs";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { unmodifyNavUser } from "./modifies/modify-nav-user";
import { unmodifyLayoutServer } from "./modifies/+layout.server";
import { unmodifyAppLayoutSvelte } from "./modifies/modify-app-layout";
import { unmodifyAppSidebar } from "./modifies/modify-app-sidebar";
import { planDropsForCollections } from "../../destroy/shared";

export async function generate(options: Options) {
  const logger = getLogger(options);
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Reverting nav-user.svelte");
  const navUserCandidates = [
    path.join(options.root, "src", "lib", "components", "nav-user.svelte"),
  ];
  const navUserPath =
    navUserCandidates.find((p) => fs.existsSync(p)) ?? navUserCandidates[0];
  pushResult(modifyOutcomeToFile(navUserPath, unmodifyNavUser(navUserPath)));

  logger.info("Reverting (app) +layout.server.ts");
  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.server.ts",
  );
  pushResult(
    modifyOutcomeToFile(
      layoutServerPath,
      unmodifyLayoutServer(layoutServerPath),
    ),
  );

  logger.info("Reverting (app) +layout.svelte");
  const appLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(appLayoutPath, unmodifyAppLayoutSvelte(appLayoutPath)),
  );

  logger.info("Reverting app-sidebar.svelte");
  const appSidebarPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "app-sidebar.svelte",
  );
  pushResult(
    modifyOutcomeToFile(appSidebarPath, unmodifyAppSidebar(appSidebarPath)),
  );

  const collectionDrops = await planDropsForCollections(
    // team_users is a view over teams, so it has to go first or PocketBase
    // refuses to drop teams ("existing reference in team_users").
    [
      "team_users",
      "team_invite_links",
      "team_invites",
      "team_memberships",
      "teams",
    ],
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
