import path from "node:path";
import fs from "node:fs";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { unmodifyNavUser } from "./modifies/modify-nav-user";
import { planDropsForCollections } from "../../destroy/shared";

const MANUAL_REMEDIATION = [
  "app-sidebar, +layout.server.ts (teams loader), and app-layout.svelte (AppSidebar team props) must be reverted manually.",
  "These edits are substantial and are not safely reversed by tooling.",
].join(" ");

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

  logger.info(MANUAL_REMEDIATION);

  const collectionDrops = await planDropsForCollections(
    ["team_invite_links", "team_invites", "team_memberships", "teams"],
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
