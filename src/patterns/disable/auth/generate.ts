import type { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const authCreatesRaw = import.meta.glob<string>(
  "../../enable/auth/creates/**",
  { query: "?raw", import: "default", eager: true },
);
const authRemoteCreatesRaw = import.meta.glob<string>(
  "../../enable/auth-remote/creates/**",
  { query: "?raw", import: "default", eager: true },
);

// enable-whatsapp's code page and helpers live on the auth pages too.
const whatsappCreatesRaw = import.meta.glob<string>(
  [
    "../../enable/whatsapp/creates/**",
    "../../enable/whatsapp/creates-superforms/**",
    "../../enable/whatsapp/creates-remote/**",
  ],
  { query: "?raw", import: "default", eager: true },
);

const AUTH_CREATES_PREFIX = "../../enable/auth/creates/";
const AUTH_REMOTE_CREATES_PREFIX = "../../enable/auth-remote/creates/";
const WHATSAPP_CREATES_PREFIX =
  /^\.\.\/\.\.\/enable\/whatsapp\/creates(-superforms|-remote)?\//;

export async function generate(_options: Options) {
  const paths = new Set<string>();
  for (const key of Object.keys(authCreatesRaw)) {
    paths.add(appRelativePath(key, AUTH_CREATES_PREFIX));
  }
  for (const key of Object.keys(authRemoteCreatesRaw)) {
    paths.add(appRelativePath(key, AUTH_REMOTE_CREATES_PREFIX));
  }
  for (const key of Object.keys(whatsappCreatesRaw)) {
    paths.add(key.replace(WHATSAPP_CREATES_PREFIX, ""));
  }

  const deletes = Array.from(paths)
    .map((path) => ({
      path,
      language: languageFromPath(path),
      content: "",
      status: "success" as const,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    creates: [],
    modifies: [],
    deletes,
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
