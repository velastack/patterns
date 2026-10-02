import {
  ensurePackageImports,
  type PackageJsonEditResult,
} from "../../../../runtime/package-imports";

/**
 * The package.json `imports` entry the app's `#locales/*.js` specifiers
 * resolve through. wuchale writes its loaders and data to `src/locales`;
 * SvelteKit 3 deprecates `alias`, so the directory is mapped the way `#lib`
 * is. wuchale's own generated imports are relative and never go through it.
 */
export const LOCALES_IMPORTS = { "#locales/*": "./src/locales/*" };

/** Add `#locales/*` to package.json `imports`; a different value already there is reported. */
export function modifyPackageImportsI18n(root: string): PackageJsonEditResult {
  return ensurePackageImports(root, LOCALES_IMPORTS);
}
