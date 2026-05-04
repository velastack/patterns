import { Options, Result } from "../../../core/types";
import { composeCreates } from "../../../core/util";

const createsRaw = import.meta.glob<string>("./creates/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const variantsRaw = import.meta.glob<string>("./variants/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const CREATES_PREFIX = "./creates/";

export async function generate(options: Options) {
  const variant =
    typeof options.input?.variant === "string"
      ? options.input.variant
      : undefined;

  const creates = composeCreates(
    createsRaw,
    CREATES_PREFIX,
    variantsRaw,
    variant,
  );

  const components = [
    "sidebar",
    "breadcrumb",
    "separator",
    "form",
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
    "file-form",
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
