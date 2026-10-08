import type { File, Options, Result } from "../../../core/types";
import { filesFromGlob } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const createsSuperformsRaw = import.meta.glob<string>(
  "./creates-superforms/**",
  { query: "?raw", import: "default", eager: true },
);

const createsRemoteRaw = import.meta.glob<string>("./creates-remote/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

/**
 * The WhatsApp client helpers and the code page, in the form style of the
 * project's auth pages: superforms actions, or remote functions (auth-remote).
 */
export async function generate(
  _options: Options,
  mode: "superforms" | "remote" = "superforms",
) {
  const creates: Record<string, File> = {
    ...filesFromGlob(createsRaw, "./creates/"),
    ...(mode === "remote"
      ? filesFromGlob(createsRemoteRaw, "./creates-remote/")
      : filesFromGlob(createsSuperformsRaw, "./creates-superforms/")),
  };

  return {
    creates: Object.values(creates).sort((a, b) =>
      a.path.localeCompare(b.path),
    ),
    modifies: [],
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
