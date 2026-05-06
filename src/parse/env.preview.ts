import type { Options } from "../core/types";
import type { Collection } from "./types";

export function getPreviewCollections(
  options: Pick<Options, "features">,
): Collection[] {
  const collections: Collection[] = [];
  if (options.features.auth) {
    collections.push({
      id: "users_preview",
      name: "users",
      type: "auth",
      fields: [
        { name: "email", type: "email" },
        { name: "name", type: "text" },
      ],
    });
  }
  if (options.features.teams) {
    collections.push({
      id: "teams_preview",
      name: "teams",
      type: "base",
      fields: [
        { name: "name", type: "text" },
        { name: "owner", type: "relation", collectionId: "users_preview" },
      ],
    });
  }
  return collections;
}
