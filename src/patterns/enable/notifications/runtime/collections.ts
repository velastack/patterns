import type { CollectionSpec } from "../../../../core/types";
import { NOTIFICATION_RULE_PATCHES } from "./pocketbase";

const users = "users";

function rulesFor(collectionName: string) {
  const p = NOTIFICATION_RULE_PATCHES.find(
    (x) => x.collectionName === collectionName,
  );
  if (!p) {
    throw new Error(
      `notifications: missing NOTIFICATION_RULE_PATCHES entry for "${collectionName}"`,
    );
  }
  return {
    listRule: p.listRule,
    viewRule: p.viewRule,
    createRule: p.createRule,
    updateRule: p.updateRule,
    deleteRule: p.deleteRule,
  };
}

export const NOTIFICATIONS_PREVIEW_COLLECTIONS: CollectionSpec[] = [
  {
    name: "notifications",
    type: "base",
    ...rulesFor("notifications"),
    indexes: [
      "CREATE INDEX `idx_notifications_user_read_created` ON `notifications` (`user`, `read`, `created` DESC)",
    ],
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
        name: "user",
        type: "relation",
        cascadeDelete: true,
        collectionId: users,
        maxSelect: 1,
        minSelect: 0,
        required: true,
      },
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "body",
        type: "text",
      },
      {
        name: "read",
        type: "bool",
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
];
