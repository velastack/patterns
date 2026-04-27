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
    const withBlog = filesFromGlob(createsWithBlogRaw, CREATES_WITH_BLOG_PREFIX);
    Object.assign(creates, withBlog);
  }

  const sortedCreates = Object.values(creates).sort((a, b) =>
    a.path.localeCompare(b.path),
  );

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
