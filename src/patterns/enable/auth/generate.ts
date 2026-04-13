import { Options, Result } from "../../../core/types";
import { appRelativePath, languageFromPath } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";

export async function generate(options: Options) {
  const creates = Object.entries(createsRaw)
    .map(([key, content]) => {
      const path = appRelativePath(key, CREATES_PREFIX);
      return {
        path,
        language: languageFromPath(path),
        content,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const components = [
    "file",
    "form",
    "sidebar",
    "breadcrumb",
    "form",
    "collapsible",
    "avatar",
    "dropdown",
    "menu",
    "card",
    "input",
    "label",
    "badge",
    "dialog",
    "checkbox",
    "auth",
    "menu",
  ];

  if (options.features.payments) {
    components.push("alert-dialog");
  }

  return {
    creates,
    modifies: [],
    deletes: [],
    components,
    packages: [],
  } satisfies Result;
}
