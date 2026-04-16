import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { languageFromPath } from "../../../core/util";
import { applyCollectionRulePatches } from "../../../runtime/collections";
import { getMigrationFile, withPocketbase } from "../../../runtime/pocketbase";
import { modifyAppLayoutSvelte } from "./modifies/modify-app-layout";
import { modifyAppSidebar } from "./modifies/modify-app-sidebar";
import { modifyLayoutServer } from "./modifies/+layout.server";
import { modifyNavUser } from "./modifies/modify-nav-user";
import { TEAM_RULE_PATCHES } from "./teams-pocketbase";

function pushMigrationCreates(
  creates: File[],
  collectionName: string,
  options: Options,
) {
  const migrationFile = getMigrationFile(collectionName, "created", options);
  if (!migrationFile) {
    return;
  }
  creates.push({
    path: migrationFile,
    language: languageFromPath(migrationFile),
    content: fs.readFileSync(migrationFile, "utf8"),
  });
}

export async function generate(options: Options) {
  const creates: File[] = [];

  await withPocketbase(options.root, async (pb) => {
    const userCollection = await pb.collections.getOne("users");

    const teamsCollection = await pb.collections.create({
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
    pushMigrationCreates(creates, "teams", options);

    const teamMembershipsCollection = await pb.collections.create({
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
    pushMigrationCreates(creates, "team_memberships", options);

    await pb.collections.create({
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
    pushMigrationCreates(creates, "team_users", options);

    await pb.collections.create({
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
    pushMigrationCreates(creates, "team_invites", options);

    await pb.collections.create({
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
    pushMigrationCreates(creates, "team_invite_links", options);

    const ruleMigrations = await applyCollectionRulePatches(
      pb,
      TEAM_RULE_PATCHES,
      options,
    );
    creates.push(...ruleMigrations);
  });

  const modifies: File[] = [];

  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.server.ts",
  );
  if (fs.existsSync(layoutServerPath)) {
    modifyLayoutServer(layoutServerPath);
    modifies.push({
      path: layoutServerPath,
      language: "ts",
      content: fs.readFileSync(layoutServerPath, "utf8"),
    });
  }

  const appLayoutPath = path.join(
    options.root,
    "src",
    "routes",
    "(app)",
    "+layout.svelte",
  );
  if (fs.existsSync(appLayoutPath) && modifyAppLayoutSvelte(appLayoutPath)) {
    modifies.push({
      path: appLayoutPath,
      language: "svelte",
      content: fs.readFileSync(appLayoutPath, "utf8"),
    });
  }

  const appSidebarPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "app-sidebar.svelte",
  );
  if (fs.existsSync(appSidebarPath) && modifyAppSidebar(appSidebarPath)) {
    modifies.push({
      path: appSidebarPath,
      language: "svelte",
      content: fs.readFileSync(appSidebarPath, "utf8"),
    });
  }

  const navUserPath = path.join(
    options.root,
    "src",
    "lib",
    "components",
    "nav-user.svelte",
  );
  if (modifyNavUser(navUserPath)) {
    modifies.push({
      path: navUserPath,
      language: "svelte",
      content: fs.readFileSync(navUserPath, "utf8"),
    });
  }

  return {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
  } satisfies Result;
}
