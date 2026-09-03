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
 * target TanStack Table v8; npm's `latest` tag now points at v9, whose types
 * are incompatible, so every install of it has to carry this range.
 */
export const TANSTACK_TABLE_CORE = "@tanstack/table-core@^8.21.3";

/** `file-form` and `multiselect` build on formsnap's field context. */
export const FORMSNAP = "formsnap@^2.0.1";
