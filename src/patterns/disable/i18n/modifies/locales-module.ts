/**
 * Matches an import of wuchale's `src/locales/<name>.js` the way enable-i18n
 * writes it (`#locales/main.url.js`), and the `$locales/main.url` alias form
 * it wrote before SvelteKit 3, so disabling works on either.
 */
export function localesModule(name: string): (specifier: string) => boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^[$#]locales/${escaped}(\\.js)?$`);
  return (specifier) => pattern.test(specifier);
}
