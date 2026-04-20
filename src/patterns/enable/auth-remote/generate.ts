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
        status: "success" as const,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const components = [
    "sidebar",
    "breadcrumb",
    "separator",
    "collapsible",
    "avatar",
    "dropdown-menu",
    "card",
    "input",
    "label",
    "button",
    "badge",
    "dialog",
    "checkbox",
    "auth-menu",
  ];

  if (options.features.payments) {
    components.push("alert-dialog");
  }

  const collections = [
    {
      listRule: "@request.auth.id = user.id",
      viewRule: "@request.auth.id = user.id",
      name: "oauth_accounts",
      type: "base" as const,
      fields: [
        {
          collectionId: "_pb_users_auth_",
          name: "user",
          type: "relation",
          required: true,
          maxSelect: 1,
        },
        {
          name: "providerId",
          required: true,
          type: "text",
        },
        {
          name: "provider",
          required: true,
          type: "text",
        },
        {
          name: "accessToken",
          type: "text",
        },
        {
          name: "refreshToken",
          type: "text",
        },
        {
          name: "avatarURL",
          type: "text",
        },
        {
          name: "expiry",
          type: "date",
        },
        {
          name: "email",
          type: "text",
        },
        {
          name: "name",
          type: "text",
        },
        {
          name: "username",
          type: "text",
        },
        {
          name: "rawUser",
          type: "json",
        },
      ],
    },
  ];

  return {
    creates,
    modifies: [],
    deletes: [],
    components,
    packages: [],
    collections,
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
