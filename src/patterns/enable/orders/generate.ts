import type { CollectionSpec, Options, Result } from "../../../core/types";
import { filesFromGlob } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});
// A signed-in buyer's orders: the user link on the record, and the pages
// that list them.
const createsAppModeRaw = import.meta.glob<string>("./creates-app-mode/**", {
  query: "?raw",
  import: "default",
  eager: true,
});
// With enable-notifications: a paid order drops a notification on its user.
const createsNotificationsRaw = import.meta.glob<string>(
  "./creates-notifications/**",
  { query: "?raw", import: "default", eager: true },
);

/** The collections in the order they are created, and dropped in reverse. */
export const ORDER_COLLECTIONS = ["orders", "order_lines"];

/**
 * One row per Checkout Session, keyed by its id so Stripe's redeliveries and
 * replays update rather than duplicate. With auth, the buyer's Stripe customer
 * and user.
 */
function orders(appMode: boolean): CollectionSpec {
  return {
    name: "orders",
    type: "base",
    fields: [
      {
        name: "id",
        pattern: "^[a-zA-Z0-9_]+$",
        primaryKey: true,
        required: true,
        system: true,
        type: "text",
      },
      // Stripe's payment_status: paid, unpaid, no_payment_required.
      { name: "status", required: true, type: "text" },
      { name: "amount_total", required: false, type: "number" },
      { name: "currency", required: false, type: "text" },
      { name: "email", required: false, type: "text" },
      { name: "payment_intent", required: false, type: "text" },
      ...(appMode
        ? [
            {
              collectionId: "stripe_customers",
              maxSelect: 1,
              minSelect: 0,
              name: "customer",
              required: false,
              type: "relation",
            },
            {
              collectionId: "_pb_users_auth_",
              maxSelect: 1,
              minSelect: 0,
              name: "user",
              required: false,
              type: "relation",
            },
          ]
        : []),
      { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
      { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
    ],
  };
}

/** A snapshot of each line as Stripe priced it, keyed by Stripe's line item id. */
const orderLines: CollectionSpec = {
  name: "order_lines",
  type: "base",
  fields: [
    {
      name: "id",
      pattern: "^[a-zA-Z0-9_]+$",
      primaryKey: true,
      required: true,
      system: true,
      type: "text",
    },
    {
      collectionId: "orders",
      maxSelect: 1,
      minSelect: 0,
      name: "order",
      required: true,
      type: "relation",
      cascadeDelete: true,
    },
    { name: "price", required: false, type: "text" },
    { name: "product", required: false, type: "text" },
    { name: "name", required: false, type: "text" },
    { name: "unit_amount", required: false, type: "number" },
    { name: "quantity", required: false, type: "number" },
    { name: "amount_total", required: false, type: "number" },
    { name: "currency", required: false, type: "text" },
    { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
    { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
  ],
};

export async function generate(options: Options) {
  const appMode = options.features.auth;
  const creates = new Map(
    Object.values(filesFromGlob(createsRaw, "./creates/")).map((file) => [
      file.path,
      file,
    ]),
  );
  if (appMode) {
    for (const file of Object.values(
      filesFromGlob(createsAppModeRaw, "./creates-app-mode/"),
    )) {
      creates.set(file.path, file);
    }
    if (options.features.notifications) {
      for (const file of Object.values(
        filesFromGlob(createsNotificationsRaw, "./creates-notifications/"),
      )) {
        creates.set(file.path, file);
      }
    }
  }

  return {
    creates: [...creates.values()].sort((a, b) => a.path.localeCompare(b.path)),
    modifies: [],
    deletes: [],
    components: appMode ? ["card", "badge", "separator"] : [],
    packages: [],
    collections: [orders(appMode), orderLines],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
