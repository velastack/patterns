import type { CollectionSpec } from "../../../../core/types";
import { TEAM_RULE_PATCHES } from "./pocketbase";

/** Relation targets use collection names as readable stand-ins for PocketBase collection ids in preview. */
const users = "users";
const teams = "teams";
const teamMemberships = "team_memberships";

function rulesFor(collectionName: string) {
  const p = TEAM_RULE_PATCHES.find((x) => x.collectionName === collectionName);
  if (!p) {
    throw new Error(`teams: missing TEAM_RULE_PATCHES entry for "${collectionName}"`);
  }
  return {
    listRule: p.listRule,
    viewRule: p.viewRule,
    createRule: p.createRule,
    updateRule: p.updateRule,
    deleteRule: p.deleteRule,
  };
}

/**
 * PocketBase collections created at runtime (see `generate.runtime.ts`), with API rules merged.
 * Exposed in preview results for docs and schema previews without running migrations.
 */
export const TEAMS_PREVIEW_COLLECTIONS: CollectionSpec[] = [
  {
    name: "teams",
    type: "base",
    ...rulesFor("teams"),
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
        collectionId: users,
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
  },
  {
    name: "team_memberships",
    type: "base",
    ...rulesFor("team_memberships"),
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
        collectionId: teams,
        maxSelect: 1,
        minSelect: 0,
        required: true,
        type: "relation",
      },
      {
        name: "user",
        cascadeDelete: true,
        collectionId: users,
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
  },
  {
    name: "team_users",
    type: "view",
    ...rulesFor("team_users"),
    viewQuery:
      "select users.id, users.email, users.name, team_memberships.id as membership_id, team_memberships.team, team_memberships.role from users join team_memberships on team_memberships.user = users.id;",
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
        collectionId: teamMemberships,
        maxSelect: 1,
        minSelect: 0,
        required: false,
        type: "relation",
      },
      {
        name: "team",
        cascadeDelete: true,
        collectionId: teams,
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
  },
  {
    name: "team_invites",
    type: "base",
    ...rulesFor("team_invites"),
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
        collectionId: teams,
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
  },
  {
    name: "team_invite_links",
    type: "base",
    ...rulesFor("team_invite_links"),
    indexes: [
      "CREATE UNIQUE INDEX `idx_9y3Oz1KVzz` ON `team_invite_links` (`team`)",
    ],
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
        collectionId: teams,
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
  },
];
