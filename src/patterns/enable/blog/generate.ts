import type { File, Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const createsWithNegotiationRaw = import.meta.glob<string>(
  "./creates-with-negotiation/**",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const CREATES_PREFIX = "./creates/";
const CREATES_WITH_NEGOTIATION_PREFIX = "./creates-with-negotiation/";

function filesFromGlob(
  raw: Record<string, string>,
  prefix: string,
): Record<string, File> {
  const files: Record<string, File> = {};
  for (const [key, content] of Object.entries(raw)) {
    const path = appRelativePath(key, prefix);
    files[path] = {
      path,
      language: languageFromPath(path),
      content,
      status: "success",
    };
  }
  return files;
}

export async function generate(options: Options) {
  const base = filesFromGlob(createsRaw, CREATES_PREFIX);
  const creates: Record<string, File> = { ...base };

  if (options.features.contentNegotiation) {
    const withNegotiation = filesFromGlob(
      createsWithNegotiationRaw,
      CREATES_WITH_NEGOTIATION_PREFIX,
    );
    Object.assign(creates, withNegotiation);
  }

  const sortedCreates = Object.values(creates).sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  return {
    creates: sortedCreates,
    modifies: [],
    deletes: [],
    components: ["avatar", "badge", "breadcrumb", "card", "separator"],
    packages: ["mdsvex"],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
