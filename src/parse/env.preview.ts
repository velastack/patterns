import type { Options } from "../core/types";
import type { Collection } from "./types";

export function getPreviewCollections(
  options: Pick<Options, "features">,
): Collection[] {
  if (options.features.auth) {
    return [
      {
        id: "users_preview",
        name: "users",
        type: "auth",
        fields: [
          { name: "email", type: "email" },
          { name: "name", type: "text" },
        ],
      },
    ];
  }
  return [];
}
