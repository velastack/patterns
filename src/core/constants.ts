export const DATA_DIR = "data";
export const MIGRATIONS_DIR = "migrations";
export const FIXTURE_PREFIX = "vela";
export const PUBLIC_DIR = "(public)";
export const APP_DIR = "(app)";
export const AUTHED_REDIRECT_PATH = "/dashboard";
export const API_URL = "http://localhost:5173";

/**
 * The table helpers this repo ships (`data-table`, `column-header`,
 * `faceted-filter`, `pagination`) and the pages the scaffold generators emit
 * target TanStack Table v9, whose API and types are incompatible with v8; see
 * `assertTableCoreV9` for projects that still have the v8 helpers.
 */
export const TANSTACK_TABLE_CORE = "@tanstack/table-core@^9.2.4";

/** The major `TANSTACK_TABLE_CORE` pins. */
export const TANSTACK_TABLE_CORE_MAJOR = 9;

/** `file-form` and `multiselect` build on formsnap's field context. */
export const FORMSNAP = "formsnap@^2.0.1";

/**
 * The superforms release that supports SvelteKit 3 (its `latest` accepts
 * only Kit 1 and 2). Installed exactly, not with a caret: a caret on a
 * prerelease would follow later `next` builds.
 */
export const SUPERFORMS_VERSION = "3.0.0-next.1";

/**
 * What a generated superforms page needs. Vela's templates already carry
 * both; a project vela did not create may have neither.
 */
export const SUPERFORMS = `sveltekit-superforms@${SUPERFORMS_VERSION}`;

/**
 * formsnap 2 peers `sveltekit-superforms ^2`, so every project that installs
 * it needs this npm override, or `npm install` fails with ERESOLVE. The value
 * is the literal version: `$sveltekit-superforms` breaks on npm 10.
 * `writeResult` adds it before any install that brings formsnap in.
 */
export const FORMSNAP_OVERRIDES = {
  formsnap: { "sveltekit-superforms": SUPERFORMS_VERSION },
};

/** The flash-message release that supports SvelteKit 3; installed exactly, like superforms. */
export const FLASH = "sveltekit-flash-message@3.0.0-next.0";

/** The adapter `vela enable backend` moves a project to. */
export const ADAPTER_NODE = "@sveltejs/adapter-node@^6.0.0";

/** The adapter a static project builds with (`vela disable backend`). */
export const ADAPTER_STATIC = "@sveltejs/adapter-static@^4.0.0";

/** The VelaStack libraries' SvelteKit 3 releases. */
export const VELASTACK_KIT = "@velastack/kit@^0.4.0";
export const VELASTACK_POCKETBASE = "@velastack/pocketbase@^0.4.0";
export const VELASTACK_CMS = "@velastack/cms@^0.6.0";
export const NEGOTIATE = "sveltekit-negotiate@^0.3.0";
export const ZOD = "zod@^4.1.11";

/** What `vela enable i18n` installs: wuchale and its Svelte adapter. */
export const WUCHALE = "wuchale@^0.26.3";
export const WUCHALE_SVELTE = "@wuchale/svelte@^0.21.1";
