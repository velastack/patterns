import type { File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { filesFromGlob } from "../../../core/util";

// The backend, for an app that hosts the CMS itself: the SQLite-backed HTTP
// API and the two routes that mount it and serve uploads.
const backendRaw = import.meta.glob<string>("./creates-backend/**", {
  query: "?raw",
  import: "default",
  eager: true,
});

const BACKEND_PREFIX = "./creates-backend/";

/** Where an app that hosts the backend itself mounts it. Also the admin bar's default. */
export const LOCAL_ENDPOINT = "/api/cms";

export const ENDPOINT_EXAMPLE =
  "https://velastack.dev/v1/projects/<project>/cms";

export interface CmsMode {
  /** What the read path and the admin bar talk to. */
  endpoint: string;
  /** Whether this app hosts the backend at `endpoint` itself. */
  local: boolean;
}

/** `--endpoint <url>` or `--endpoint=<url>`, for callers that hand flags through in argv. */
function endpointFromArgv(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--endpoint") return argv[i + 1];
    if (arg.startsWith("--endpoint=")) return arg.slice("--endpoint=".length);
  }
  return undefined;
}

/**
 * Which of the two shapes to produce.
 *
 * An explicit `--endpoint` means a hosted CMS: the app only reads from it and
 * the admin bar signs in there, so no backend is installed. Without one, an
 * app with a server hosts the backend itself at `/api/cms`. A static site has
 * no server to host it, so there the endpoint is required.
 */
export function resolveMode(options: Options): CmsMode {
  const raw =
    typeof options.input.endpoint === "string"
      ? options.input.endpoint
      : endpointFromArgv(options.argv);
  const endpoint = raw?.trim().replace(/\/+$/, "");

  if (endpoint) {
    if (!/^https?:\/\/\S+$/.test(endpoint)) {
      throw new InvalidArgumentError(
        `--endpoint must be the absolute URL of a hosted CMS, like ${ENDPOINT_EXAMPLE}; got ${endpoint}`,
      );
    }
    return { endpoint, local: false };
  }

  if (!options.features.backend) {
    throw new InvalidArgumentError(
      "This site has no server to host the CMS backend. " +
        `Point it at a hosted CMS instead: vela enable cms --endpoint ${ENDPOINT_EXAMPLE}`,
    );
  }

  return { endpoint: LOCAL_ENDPOINT, local: true };
}

/** `$lib/cms.ts`: the read path, with the endpoint and locales bound. */
function cmsLibSource(mode: CmsMode, i18n: boolean): string {
  const imports = [
    "import { apiAdapter, createCms } from '@velastack/cms/server';",
  ];
  if (i18n) imports.push("import { locales } from '$locales/data';");

  const where = mode.local
    ? [
        " * `/api/cms` is where `src/routes/api/cms/[...path]/+server.ts` mounts the",
        " * backend. It is also the admin bar's default, so the endpoint is named here",
        " * and nowhere else.",
      ]
    : [
        " * The CMS is hosted at this endpoint: the app reads published content from",
        " * it and the admin bar signs in there. The same URL is given to the `cms()`",
        " * plugin in vite.config.ts, which downloads media into the build.",
      ];

  const which = i18n
    ? [
        " * The locales are the site's own, from wuchale, so the CMS supports exactly",
        " * the languages the UI does; the first is the default that a missing",
        " * translation falls back to.",
      ]
    : [
        " * `locales` lists every locale the site supports; the first is the default",
        " * that a missing translation falls back to.",
      ];

  return [
    ...imports,
    "",
    "/**",
    " * The CMS read path, called from the root `+layout.server.ts`.",
    " *",
    ...where,
    " *",
    ...which,
    " */",
    "export const { load: loadCms, generateEntries } = createCms({",
    `\tadapter: apiAdapter({ endpoint: '${mode.endpoint}' }),`,
    `\tlocales: ${i18n ? "[...locales]" : "['en']"}`,
    "});",
    "",
  ].join("\n");
}

export async function generate(options: Options) {
  const mode = resolveMode(options);
  const creates: Record<string, File> = {};

  if (mode.local) {
    Object.assign(creates, filesFromGlob(backendRaw, BACKEND_PREFIX));
  }

  creates["src/lib/cms.ts"] = {
    path: "src/lib/cms.ts",
    language: "ts",
    content: cmsLibSource(mode, options.features.i18n),
    status: "success",
  };

  const sortedCreates = Object.values(creates).sort((a, b) =>
    a.path.localeCompare(b.path),
  );

  // better-sqlite3 and marked are the package's optional peers, which npm
  // skips on install precisely because they are optional — so they have to be
  // named here. The backend needs the first; the root entry imports the
  // second statically, so <AdminBar /> cannot render without it.
  // 0.2.2 is the first release whose Vite plugin imports from the package
  // name rather than its own source tree; 0.2.1 breaks every consumer route.
  const packages = mode.local
    ? ["@velastack/cms@^0.2.2", "better-sqlite3", "marked"]
    : ["@velastack/cms@^0.2.2", "marked"];

  return {
    creates: sortedCreates,
    modifies: [],
    deletes: [],
    components: [],
    packages,
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
