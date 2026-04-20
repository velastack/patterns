import type { File, Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>(
  "../../enable/payments/creates/**",
  { query: "?raw", import: "default", eager: true },
);

const createsAppModeRaw = import.meta.glob<string>(
  "../../enable/payments/creates-app-mode/**",
  { query: "?raw", import: "default", eager: true },
);

const CREATES_PREFIX = "../../enable/payments/creates/";
const CREATES_APP_MODE_PREFIX = "../../enable/payments/creates-app-mode/";

function filesFromGlob(
  raw: Record<string, string>,
  prefix: string,
): Record<string, File> {
  const files: Record<string, File> = {};
  for (const key of Object.keys(raw)) {
    const path = appRelativePath(key, prefix);
    files[path] = {
      path,
      language: languageFromPath(path),
      content: "",
      status: "success",
    };
  }
  return files;
}

export async function generate(options: Options) {
  const isAppMode = options.features.auth;

  const base = filesFromGlob(createsRaw, CREATES_PREFIX);
  const deletes: Record<string, File> = { ...base };

  if (isAppMode) {
    const appMode = filesFromGlob(createsAppModeRaw, CREATES_APP_MODE_PREFIX);
    Object.assign(deletes, appMode);
  }

  const sortedDeletes = Object.values(deletes).sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  return {
    creates: [],
    modifies: [],
    deletes: sortedDeletes,
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
