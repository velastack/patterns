import { PUBLIC_DIR } from "../../../core/constants";
import type { File, Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const createsWithBlogRaw = import.meta.glob<string>("./creates-with-blog/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";
const CREATES_WITH_BLOG_PREFIX = "./creates-with-blog/";

/** Where the routes are stored; `inPublicGroup` moves them to the project's own group. */
const STORED_PUBLIC_DIR = `src/routes/${PUBLIC_DIR}/`;

/**
 * A stored route path in the project's public group, or straight under
 * `src/routes` in a project without one (a SvelteKit project vela did not
 * create). Shared with disable-content-negotiation so it deletes what this
 * wrote.
 */
export function inPublicGroup(
  filePath: string,
  { routeGroups }: Pick<Options, "routeGroups">,
): string {
  if (!routeGroups || !filePath.startsWith(STORED_PUBLIC_DIR)) return filePath;
  const group = routeGroups.public ? `${routeGroups.public}/` : "";
  return `src/routes/${group}${filePath.slice(STORED_PUBLIC_DIR.length)}`;
}

/** The demo page's meta tags loader, which imports `svelte-meta-tags`. */
const META_TAGS_LOADER = /\/negotiate\/\+page\.ts$/;

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

  if (options.features.blog) {
    const withBlog = filesFromGlob(
      createsWithBlogRaw,
      CREATES_WITH_BLOG_PREFIX,
    );
    Object.assign(creates, withBlog);
  }

  // `svelte-meta-tags` is part of vela's templates, where the root layout
  // renders what the loader returns. A project without it has nothing to
  // render them with, so the loader is left out rather than the package added.
  const metaTags = options.input.metaTags ?? true;

  const sortedCreates = Object.values(creates)
    .filter((file) => metaTags || !META_TAGS_LOADER.test(file.path))
    .map((file) => ({ ...file, path: inPublicGroup(file.path, options) }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates: sortedCreates,
    modifies: [],
    deletes: [],
    components: [],
    packages: ["sveltekit-negotiate"],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
