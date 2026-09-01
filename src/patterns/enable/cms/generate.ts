import type { File, Options, Result } from "../../../core/types";
import { filesFromGlob } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

// With enable-i18n in place the CMS should speak the site's languages, so
// `$lib/cms.ts` takes its locale list from wuchale instead of a literal.
const createsI18nRaw = import.meta.glob<string>("./creates-i18n/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";
const CREATES_I18N_PREFIX = "./creates-i18n/";

export async function generate(options: Options) {
  const creates: Record<string, File> = filesFromGlob(
    createsRaw,
    CREATES_PREFIX,
  );

  if (options.features.i18n) {
    Object.assign(creates, filesFromGlob(createsI18nRaw, CREATES_I18N_PREFIX));
  }

  const sortedCreates = Object.values(creates).sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  return {
    creates: sortedCreates,
    modifies: [],
    deletes: [],
    components: [],
    // better-sqlite3 and marked are the package's optional peers, which npm
    // skips on install precisely because they are optional — so they have to
    // be named here. The backend needs the first; the root entry imports the
    // second statically, so <AdminBar /> cannot render without it.
    // 0.2.2 is the first release whose Vite plugin imports from the package
    // name rather than its own source tree; 0.2.1 breaks every consumer route.
    packages: ["@velastack/cms@^0.2.2", "better-sqlite3", "marked"],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
