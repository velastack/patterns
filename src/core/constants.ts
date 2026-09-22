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
 * What a generated superforms page needs. Vela's templates already carry
 * both; a project vela did not create may have neither.
 */
export const SUPERFORMS = "sveltekit-superforms@^2.30.2";
export const ZOD = "zod@^4.1.11";
