import type { CollectionSpec, Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";

const stripeSubscriptions: CollectionSpec = {
  name: "stripe_subscriptions",
  type: "base",
  fields: [
    {
      name: "id",
      pattern: "^[a-zA-Z0-9_]+$",
      primaryKey: true,
      required: true,
      type: "text",
    },
    {
      collectionId: "_pb_users_auth_",
      maxSelect: 1,
      minSelect: 0,
      name: "user",
      required: true,
      type: "relation",
    },
    {
      collectionId: "stripe_customers",
      maxSelect: 1,
      minSelect: 0,
      name: "customer",
      required: true,
      type: "relation",
      cascadeDelete: true,
    },
    {
      collectionId: "stripe_prices",
      maxSelect: 1,
      minSelect: 0,
      name: "price",
      required: true,
      type: "relation",
    },
    { name: "status", required: true, type: "text" },
    { name: "current_period_start", required: false, type: "date" },
    { name: "current_period_end", required: false, type: "date" },
    { name: "cancel_at_period_end", required: false, type: "bool" },
    { name: "canceled_at", required: false, type: "date" },
    { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
    { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
  ],
};

export async function generate(_options: Options) {
  const creates = Object.entries(createsRaw)
    .map(([key, content]) => {
      const path = appRelativePath(key, CREATES_PREFIX);
      return {
        path,
        language: languageFromPath(path),
        content,
        status: "success" as const,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates,
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [stripeSubscriptions],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
