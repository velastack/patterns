import { VERSIONS, spec } from "./versions";

export const DATA_DIR = "data";
export const MIGRATIONS_DIR = "migrations";
export const FIXTURE_PREFIX = "vela";
export const PUBLIC_DIR = "(public)";
export const APP_DIR = "(app)";
export const AUTHED_REDIRECT_PATH = "/dashboard";
export const API_URL = "http://localhost:5173";

/**
 * The table helpers this repo ships (`data-table`, `column-header`,
 * `faceted-filter`, `data-table-pagination`) and the pages the scaffold generators emit
 * target TanStack Table v9, whose API and types are incompatible with v8; see
 * `assertTableCoreV9` for projects that still have the v8 helpers.
 */
export const TANSTACK_TABLE_CORE = spec("@tanstack/table-core");

/** The major `TANSTACK_TABLE_CORE` pins. */
export const TANSTACK_TABLE_CORE_MAJOR = Number(
  /\d+/.exec(VERSIONS["@tanstack/table-core"]!)![0],
);

/**
 * `file-form` and `multiselect` build on formsnap's field context. 2.1.0 is
 * the first release whose superforms peer admits 3.x; 2.0 needed an npm
 * override, which `writeResult` now removes (`reconcileFormsnap`).
 */
export const FORMSNAP = spec("formsnap");

/**
 * The superforms range a project starts on: 3.x, the line that supports
 * SvelteKit 3. A caret like any other dependency, now that formsnap 2.1 peers
 * `^3.0.0`; it was an exact version while 3.0 was a `next` prerelease, because
 * a caret on a prerelease follows every later `next` build. `writeResult`,
 * `vela migrate` and `vela bless` still move a project off one of those
 * prerelease pins (`reconcileFormsnap`).
 *
 * The name is from the exact-pin days and is kept for the CLI, which imports
 * it; the value is a range.
 */
export const SUPERFORMS_VERSION = VERSIONS["sveltekit-superforms"]!;

/**
 * What a generated superforms page needs. Vela's templates already carry
 * both; a project vela did not create may have neither.
 */
export const SUPERFORMS = spec("sveltekit-superforms");

/** The flash-message line that supports SvelteKit 3. */
export const FLASH = spec("sveltekit-flash-message");

/** The adapter `vela enable backend` moves a project to. */
export const ADAPTER_NODE = spec("@sveltejs/adapter-node");

/** The adapter a static project builds with (`vela disable backend`). */
export const ADAPTER_STATIC = spec("@sveltejs/adapter-static");

/** The VelaStack libraries' SvelteKit 3 releases. */
export const VELASTACK_KIT = spec("@velastack/kit");
/** 0.4.2 or later: it proxies plugin webhooks (pocketbase-whatsapp) to PocketBase. */
export const VELASTACK_POCKETBASE = spec("@velastack/pocketbase");
export const VELASTACK_CMS = spec("@velastack/cms");
/** wa.me links, order messages and hosted order recording, for payments on WhatsApp. */
export const VELASTACK_WHATSAPP = spec("@velastack/whatsapp");
export const NEGOTIATE = spec("sveltekit-negotiate");
export const ZOD = spec("zod");
/** Renders HTML and CSS to an image; a native module, so it must be a dependency. */
export const TAKUMI = spec("@takumi-rs/core");

/** What `vela enable i18n` installs: wuchale and its Svelte adapter. */
export const WUCHALE = spec("wuchale");
export const WUCHALE_SVELTE = spec("@wuchale/svelte");
