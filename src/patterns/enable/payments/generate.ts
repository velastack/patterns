import type { File, Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const createsAppModeRaw = import.meta.glob<string>("./creates-app-mode/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";
const CREATES_APP_MODE_PREFIX = "./creates-app-mode/";

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
  const isAppMode = options.features.auth;

  const base = filesFromGlob(createsRaw, CREATES_PREFIX);
  const creates: Record<string, File> = { ...base };

  if (isAppMode) {
    const appMode = filesFromGlob(createsAppModeRaw, CREATES_APP_MODE_PREFIX);
    Object.assign(creates, appMode);
  }

  const sortedCreates = Object.values(creates).sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  const components = ["dialog", "input", "label"];
  if (isAppMode) {
    components.push("alert-dialog");
  }

  return {
    creates: sortedCreates,
    modifies: [],
    deletes: [],
    components,
    packages: ["stripe", "@stripe/stripe-js"],
    collections: [],
  } satisfies Result;
}
