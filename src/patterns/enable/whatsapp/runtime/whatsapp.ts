import fs from "node:fs";
import path from "node:path";
import type PocketBase from "pocketbase";
import type { Options } from "../../../../core/types";
import { MIGRATIONS_DIR } from "../../../../core/constants";

/** pocketbase-whatsapp's `PhonePattern`: E.164. */
const PHONE_PATTERN = "^\\+[1-9][0-9]{7,14}$";

/** The first pocketbase-server with the plugin and its env-only sender. */
export const MIN_POCKETBASE_SERVER = "0.40.5-beta.5";

/**
 * Whether the server has the pocketbase-whatsapp plugin that velabase ships.
 * Vanilla PocketBase and older pocketbase-server answer 404.
 */
export async function hasWhatsAppPlugin(pb: PocketBase): Promise<boolean> {
  try {
    await pb.send("/api/whatsapp/collections", { method: "GET" });
    return true;
  } catch (error: any) {
    if (error?.status === 404) return false;
    throw error;
  }
}

/**
 * Gets `users` ready for WhatsApp sign-in:
 *
 * - `phone`: E.164 text with a unique index, the number users sign in with;
 * - `phoneVerified`: set once a code proves the number (`verified` is about
 *   the email);
 * - `email` optional, since a WhatsApp signup has none.
 *
 * Through the collections API, not the plugin's "Create phone field"
 * endpoint: automigrate only writes a migration for collection changes made
 * over the API, so a save from inside the plugin would never reach
 * production.
 *
 * Returns whether `users` changed (and so wrote a migration).
 */
export async function setupWhatsAppFields(pb: PocketBase): Promise<boolean> {
  const users = await pb.collections.getOne("users");
  const has = (name: string) =>
    users.fields.some((f: { name: string }) => f.name === name);

  let changed = false;
  const fields: Record<string, unknown>[] = users.fields.map(
    (field: Record<string, unknown>) => {
      if (field.name === "email" && field.required) {
        changed = true;
        return { ...field, required: false };
      }
      return field;
    },
  );
  if (!has("phone")) {
    changed = true;
    fields.push({
      name: "phone",
      type: "text",
      pattern: PHONE_PATTERN,
      max: 16,
    });
  }
  if (!has("phoneVerified")) {
    changed = true;
    fields.push({ name: "phoneVerified", type: "bool" });
  }

  const indexes = [...users.indexes];
  if (!indexes.some((index) => /\(\s*`?phone`?\s*\)/.test(index))) {
    changed = true;
    // Unique among the numbers that are set: email-only users have none.
    indexes.push(
      "CREATE UNIQUE INDEX `idx_users_phone` ON `users` (`phone`) WHERE `phone` != ''",
    );
  }

  if (changed) {
    await pb.collections.update("users", { fields, indexes });
  }
  return changed;
}

/**
 * Turns WhatsApp sign-in and signup on for `users` in this PocketBase. The
 * plugin keeps that in its own store, which automigrate does not see, so
 * deployments get it from `writeWhatsAppConfigMigration` instead.
 *
 * With no sender configured yet, the sender is `dev`: codes go to the
 * PocketBase log. A deployment's env credentials take precedence over it.
 */
export async function enableWhatsAppAuth(pb: PocketBase): Promise<void> {
  await pb.send("/api/whatsapp/collections/users", {
    method: "PATCH",
    body: {
      enabled: true,
      allowSignup: true,
      phoneField: "phone",
      phoneVerifiedField: "phoneVerified",
    },
  });

  const response = await pb.send("/api/whatsapp/settings", { method: "GET" });
  if (!response?.settings?.mode) {
    await pb.send("/api/whatsapp/settings", {
      method: "PATCH",
      body: { mode: "dev" },
    });
  }
}

/** Turns WhatsApp sign-in off for `users` in this PocketBase. */
export async function disableWhatsAppAuth(pb: PocketBase): Promise<void> {
  await pb.send("/api/whatsapp/collections/users", {
    method: "PATCH",
    body: { enabled: false },
  });
}

const CONFIG_MIGRATION = /^\d+_(enabled|disabled)_whatsapp_users\.js$/;

/**
 * A migration that sets the plugin's `users` config (`_whatsapp`, key
 * `collection:<id>`) on every PocketBase it runs on. The plugin's own system
 * migration creates `_whatsapp` before any app migration runs.
 *
 * Returns `null`, writing nothing, when the latest such migration already
 * leaves WhatsApp in that state, so a re-run adds no migration.
 */
export function writeWhatsAppConfigMigration(
  options: Options,
  enabled: boolean,
): string | null {
  const dir = path.join(options.root, MIGRATIONS_DIR);
  const latest = fs
    .readdirSync(dir)
    .filter((file) => CONFIG_MIGRATION.test(file))
    .sort()
    .pop();
  if (latest?.includes(enabled ? "_enabled_" : "_disabled_")) return null;

  const config = enabled
    ? {
        enabled: true,
        allowSignup: true,
        phoneField: "phone",
        phoneVerifiedField: "phoneVerified",
      }
    : { enabled: false };
  const name = `${Math.floor(Date.now() / 1000)}_${enabled ? "enabled" : "disabled"}_whatsapp_users.js`;
  const file = path.join(dir, name);
  fs.writeFileSync(file, whatsappConfigMigration(config), "utf8");
  return file;
}

function whatsappConfigMigration(config: Record<string, unknown>): string {
  return `/// <reference path="../pb_data/types.d.ts" />

// WhatsApp sign-in for users (pocketbase-whatsapp). The plugin keeps this in
// \`_whatsapp\`, which automigrate does not see, so this migration carries it
// to every deployment. The sender comes from the env (VELASTACK_API_KEY, or
// WHATSAPP_ACCESS_TOKEN and co.), or Settings > WhatsApp.
const CONFIG = ${JSON.stringify(config)};

function setConfig(app, values) {
  const users = app.findCollectionByNameOrId("users");
  const key = "collection:" + users.id;

  let record;
  try {
    record = app.findFirstRecordByData("_whatsapp", "key", key);
  } catch {
    record = new Record(app.findCollectionByNameOrId("_whatsapp"));
    record.set("key", key);
  }

  let current = {};
  try {
    current = JSON.parse(record.getString("value") || "{}");
  } catch {}

  record.set("value", JSON.stringify(Object.assign(current, values)));
  app.save(record);
}

migrate(
  (app) => setConfig(app, CONFIG),
  (app) => setConfig(app, { enabled: !CONFIG.enabled }),
);
`;
}
