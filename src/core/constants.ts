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

/**
 * `file-form` and `multiselect` build on formsnap's field context. 2.1.0 is
 * the first release whose superforms peer admits 3.x; 2.0 needed an npm
 * override, which `writeResult` now removes (`reconcileFormsnap`).
 */
export const FORMSNAP = "formsnap@^2.1.0";

/**
 * The superforms release that supports SvelteKit 3. Installed exactly, as the
 * `next` builds before it were (`FLASH` too): `vela migrate` and `vela bless`
 * move projects from those prerelease pins onto the releases, and formsnap's
 * `^3.0.0` peer admits the release only.
 */
export const SUPERFORMS_VERSION = "3.0.0";

/**
 * What a generated superforms page needs. Vela's templates already carry
 * both; a project vela did not create may have neither.
 */
export const SUPERFORMS = `sveltekit-superforms@${SUPERFORMS_VERSION}`;

/** The flash-message release that supports SvelteKit 3; installed exactly, like superforms. */
export const FLASH = "sveltekit-flash-message@3.0.0";

/** The adapter `vela enable backend` moves a project to. */
export const ADAPTER_NODE = "@sveltejs/adapter-node@^6.0.0";

/** The adapter a static project builds with (`vela disable backend`). */
export const ADAPTER_STATIC = "@sveltejs/adapter-static@^4.0.0";

/** The VelaStack libraries' SvelteKit 3 releases. */
export const VELASTACK_KIT = "@velastack/kit@^0.4.0";
/** 0.4.2 proxies plugin webhooks (pocketbase-whatsapp) to PocketBase. */
export const VELASTACK_POCKETBASE = "@velastack/pocketbase@^0.4.2";
export const VELASTACK_CMS = "@velastack/cms@^0.6.0";
/** wa.me links, order messages and hosted order recording, for payments on WhatsApp. */
export const VELASTACK_WHATSAPP = "@velastack/whatsapp@^0.1.0";
export const NEGOTIATE = "sveltekit-negotiate@^0.3.0";
export const ZOD = "zod@^4.1.11";

/** What `vela enable i18n` installs: wuchale and its Svelte adapter. */
export const WUCHALE = "wuchale@^0.26.3";
export const WUCHALE_SVELTE = "@wuchale/svelte@^0.21.1";
