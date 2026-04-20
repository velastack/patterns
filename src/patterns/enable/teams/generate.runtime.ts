import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { languageFromPath } from "../../../core/util";
import {
  applyCollectionRulePatches,
  createCollectionIdempotent,
} from "../../../runtime/collections";
import {
  getMigrationFile,
  migrationDelay,
  withPocketbase,
} from "../../../runtime/pocketbase";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyAppLayoutSvelte } from "./modifies/modify-app-layout";
import { modifyAppSidebar } from "./modifies/modify-app-sidebar";
import { modifyLayoutServer } from "./modifies/+layout.server";
import { modifyNavUser } from "./modifies/modify-nav-user";
import { TEAM_RULE_PATCHES } from "./runtime/pocketbase";

async function pushMigrationCreates(
  creates: File[],
  collectionName: string,
  options: Options,
  created = true,
) {
  if (!created) return;
  // Wait so the next schema op lands in a different PocketBase timestamp second.
  await migrationDelay();
  const migrationFile = getMigrationFile(collectionName, "created", options);
  if (!migrationFile) {
    return;
  }
  creates.push({
    path: migrationFile,
    language: languageFromPath(migrationFile),
    content: fs.readFileSync(migrationFile, "utf8"),
    status: "success",
  });
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const creates: File[] = [];

  await withPocketbase(options.root, async (pb) => {
    const userCollection = await pb.collections.getOne("users");
    const create = (
      spec: Parameters<typeof createCollectionIdempotent>[1],
    ) => createCollectionIdempotent(pb, spec, logger);

    logger.info("Creating teams collection");
    const teamsResult = await create({
      name: "teams",
      type: "base",
      fields: [
        {
          name: "id",
          type: "text",
          primaryKey: true,
          autogeneratePattern: "[a-z0-9]{15}",
          max: 15,
          min: 15,
          pattern: "^[a-z0-9]+$",
          required: true,
        },
        {
          name: "name",
          type: "text",
          required: true,
        },
        {
          name: "owner",
          type: "relation",
          cascadeDelete: false,
          collectionId: userCollection.id,
          maxSelect: 1,
          minSelect: 0,
          required: true,
        },
        {
          name: "created",
          type: "autodate",
          onCreate: true,
          onUpdate: false,
        },
        {
          name: "updated",
          type: "autodate",
          onCreate: true,
          onUpdate: true,
        },
      ],
    });
    const teamsCollection = teamsResult.collection;
    await pushMigrationCreates(creates, "teams", options, teamsResult.created);

    logger.info("Creating team_memberships collection");
    const teamMembershipsResult = await create({
      name: "team_memberships",
      type: "base",
      fields: [
        {
          name: "id",
          autogeneratePattern: "[a-z0-9]{15}",
          max: 15,
          min: 15,
          pattern: "^[a-z0-9]+$",
          primaryKey: true,
          required: true,
          type: "text",
        },
        {
          name: "team",
          cascadeDelete: true,
          collectionId: teamsCollection.id,
          maxSelect: 1,
          minSelect: 0,
          required: true,
          type: "relation",
        },
        {
          name: "user",
          cascadeDelete: true,
          collectionId: userCollection.id,
          maxSelect: 1,
          minSelect: 0,
          required: true,
          type: "relation",
        },
        {
          name: "role",
          maxSelect: 1,
          required: true,
          type: "select",
          values: ["owner", "admin", "member"],
        },
        {
          name: "created",
          onCreate: true,
          onUpdate: false,
          type: "autodate",
        },
        {
          name: "updated",
          onCreate: true,
          onUpdate: true,
          type: "autodate",
        },
      ],
    });
    const teamMembershipsCollection = teamMembershipsResult.collection;
    await pushMigrationCreates(
      creates,
      "team_memberships",
      options,
      teamMembershipsResult.created,
    );

    logger.info("Creating team_users view");
    const teamUsersResult = await create({
      name: "team_users",
      type: "view",
      fields: [
        {
          name: "id",
          pattern: "^[a-z0-9]+$",
          primaryKey: true,
          required: true,
          type: "text",
        },
        {
          name: "email",
          exceptDomains: null,
          onlyDomains: null,
          required: true,
          type: "email",
        },
        {
          name: "name",
          max: 255,
          required: false,
          type: "text",
        },
        {
          name: "membership_id",
          cascadeDelete: false,
          collectionId: teamMembershipsCollection.id,
          maxSelect: 1,
          minSelect: 0,
          required: false,
          type: "relation",
        },
        {
          name: "team",
          cascadeDelete: true,
          collectionId: teamsCollection.id,
          maxSelect: 1,
          minSelect: 0,
          required: true,
          type: "relation",
        },
        {
          name: "role",
          maxSelect: 1,
          required: true,
          type: "select",
          values: ["owner", "admin", "member"],
        },
      ],
      viewQuery:
        "select users.id, users.email, users.name, team_memberships.id as membership_id, team_memberships.team, team_memberships.role from users join team_memberships on team_memberships.user = users.id;",
    });
    await pushMigrationCreates(
      creates,
      "team_users",
      options,
      teamUsersResult.created,
    );

    logger.info("Creating team_invites collection");
    const teamInvitesResult = await create({
      name: "team_invites",
      type: "base",
      fields: [
        {
          name: "id",
          type: "text",
          primaryKey: true,
          autogeneratePattern: "[a-z0-9]{15}",
          max: 15,
          min: 15,
          pattern: "^[a-z0-9]+$",
          required: true,
        },
        {
          name: "team",
          type: "relation",
          cascadeDelete: true,
          collectionId: teamsCollection.id,
          maxSelect: 1,
          minSelect: 0,
          required: true,
        },
        {
          name: "email",
          type: "email",
          required: true,
        },
        {
          name: "created",
          onCreate: true,
          onUpdate: false,
          type: "autodate",
        },
        {
          name: "updated",
          onCreate: true,
          onUpdate: true,
          type: "autodate",
        },
      ],
    });
    await pushMigrationCreates(
      creates,
      "team_invites",
      options,
      teamInvitesResult.created,
    );

    logger.info("Creating team_invite_links collection");
    const teamInviteLinksResult = await create({
      name: "team_invite_links",
      type: "base",
      fields: [
        {
          name: "id",
          autogeneratePattern: "[a-z0-9]{15}",
          max: 15,
          min: 15,
          pattern: "^[a-z0-9]+$",
          primaryKey: true,
          required: true,
          type: "text",
        },
        {
          name: "team",
          cascadeDelete: true,
          collectionId: teamsCollection.id,
          maxSelect: 1,
          minSelect: 0,
          required: true,
          type: "relation",
        },
        {
          name: "created",
          onCreate: true,
          onUpdate: false,
          type: "autodate",
        },
        {
          name: "updated",
          onCreate: true,
          onUpdate: true,
          type: "autodate",
        },
      ],
      indexes: [
        "CREATE UNIQUE INDEX `idx_9y3Oz1KVzz` ON `team_invite_links` (`team`)",
      ],
    });
    await pushMigrationCreates(
      creates,
      "team_invite_links",
      options,
      teamInviteLinksResult.created,
    );

    logger.info("Applying team rule patches");
    const ruleMigrations = await applyCollectionRulePatches(
      pb,
      TEAM_RULE_PATCHES,
      options,
      logger,
    );
    creates.push(...ruleMigrations);
  });

  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Modifying (app) +layout.server.ts");
  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.server.ts",
  );
  pushResult(
    modifyOutcomeToFile(layoutServerPath, modifyLayoutServer(layoutServerPath)),
  );

  logger.info("Modifying (app) +layout.svelte");
  const appLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.svelte",
  );
  pushResult(
    modifyOutcomeToFile(appLayoutPath, modifyAppLayoutSvelte(appLayoutPath)),
  );

  logger.info("Modifying app-sidebar");
  const appSidebarPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "app-sidebar.svelte",
  );
  pushResult(
    modifyOutcomeToFile(appSidebarPath, modifyAppSidebar(appSidebarPath)),
  );

  logger.info("Modifying nav-user");
  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  pushResult(modifyOutcomeToFile(navUserPath, modifyNavUser(navUserPath)));

  return {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
  } satisfies Result;
}
