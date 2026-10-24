import type { Options, Result } from "../../../core/types";
import { filesFromGlob, languageFromPath } from "../../../core/util";

// Every variant goes, whatever auth and notifications are now: either may
// have changed since orders was enabled.
const createsRaw = import.meta.glob<string>("../../enable/orders/creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});
const createsAppModeRaw = import.meta.glob<string>(
  "../../enable/orders/creates-app-mode/**",
  { query: "?raw", import: "default", eager: true },
);
const createsNotificationsRaw = import.meta.glob<string>(
  "../../enable/orders/creates-notifications/**",
  { query: "?raw", import: "default", eager: true },
);

export async function generate(_options: Options) {
  const paths = new Set([
    ...Object.keys(filesFromGlob(createsRaw, "../../enable/orders/creates/")),
    ...Object.keys(
      filesFromGlob(createsAppModeRaw, "../../enable/orders/creates-app-mode/"),
    ),
    ...Object.keys(
      filesFromGlob(
        createsNotificationsRaw,
        "../../enable/orders/creates-notifications/",
      ),
    ),
  ]);

  return {
    creates: [],
    modifies: [],
    deletes: [...paths].sort().map((path) => ({
      path,
      language: languageFromPath(path),
      content: "",
      status: "success" as const,
    })),
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
