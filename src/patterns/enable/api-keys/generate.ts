import type { CollectionSpec, Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";

const apiKeysCollection: CollectionSpec = {
  listRule: "@request.auth.id = user.id",
  viewRule: "@request.auth.id = user.id",
  createRule: "@request.auth.id = user.id",
  updateRule: "@request.auth.id = user.id",
  deleteRule: "@request.auth.id = user.id",
  name: "api_keys",
  type: "base",
  fields: [
    {
      collectionId: "_pb_users_auth_",
      maxSelect: 1,
      name: "user",
      type: "relation",
    },
    {
      name: "key_hash",
      type: "text",
    },
    {
      name: "label",
      type: "text",
      required: true,
    },
    {
      name: "last_used",
      type: "date",
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
    components: ["alert-dialog", "button", "badge"],
    packages: ["argon2", "@types/node"],
    collections: [apiKeysCollection],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
