import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import dedent from "dedent";

import { modifyHooksServerI18n } from "./hooks.server";
import { ensureRootLayoutI18n } from "./+layout";
import { unmodifyHooksServerI18n } from "../../../disable/i18n/modifies/hooks.server";
import { unmodifyRootLayoutI18n } from "../../../disable/i18n/modifies/+layout";
import { modifyAppDts } from "./app-d-ts";
import { modifyLayoutServerLocale } from "./layout.server";
import { modifyAppLayoutLanguageSelect } from "./app-layout.svelte";
import { unmodifyAppDts } from "../../../disable/i18n/modifies/app-d-ts";
import { unmodifyLayoutServerLocale } from "../../../disable/i18n/modifies/layout.server";
import { unmodifyAppLayoutLanguageSelect } from "../../../disable/i18n/modifies/app-layout.svelte";

const authLayout = path.join(
  __dirname,
  "../../auth/creates/src/routes/(app)/+layout.svelte",
);

/**
 * What the preference model adds on top of the URL-only one: the language
 * the hook chose is typed on `App.Locals`, returned by the root layout's
 * server load, and switchable from the signed-in layout. Each is checked
 * with its revert, since disable-i18n has to leave the file as it found it.
 */
describe("enable i18n: language by preference", () => {
  let dir: string;
  const write = (name: string, source: string) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, source);
    return file;
  };
  const read = (file: string) => fs.readFileSync(file, "utf8");

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "i18n-preference-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe("app.d.ts", () => {
    const SV_CREATE = dedent`
      declare global {
      	namespace App {
      		// interface Error {}
      		// interface Locals {}
      		// interface PageData {}
      	}
      }

      export {};
    `;

    it("switches on the Locals interface sv create leaves commented out", () => {
      const file = write("app.d.ts", SV_CREATE);

      expect(modifyAppDts(file)).toEqual({ status: "success", changed: true });
      expect(read(file)).toContain(
        [
          "\t\tinterface Locals {",
          "\t\t\t/** The language of this request: see src/lib/locale.ts. */",
          "\t\t\tlocale: import('#locales/data.js').Locale;",
          "\t\t}",
          "\t\t// interface PageData {}",
        ].join("\n"),
      );
      expect(modifyAppDts(file)).toEqual({ status: "success", changed: false });

      expect(unmodifyAppDts(file)).toEqual({
        status: "success",
        changed: true,
      });
      expect(read(file)).toBe(SV_CREATE);
    });

    it("joins the members Locals already declares", () => {
      const original = SV_CREATE.replace(
        "// interface Locals {}",
        "interface Locals {\n\t\t\tuser: string | null;\n\t\t}",
      );
      const file = write("app.d.ts", original);

      expect(modifyAppDts(file).status).toBe("success");
      expect(read(file)).toContain(
        "locale: import('#locales/data.js').Locale;\n\t\t\tuser: string | null;",
      );

      expect(unmodifyAppDts(file).status).toBe("success");
      expect(read(file)).toBe(original);
    });

    it("leaves a locale the project declared itself", () => {
      const file = write(
        "app.d.ts",
        SV_CREATE.replace(
          "// interface Locals {}",
          "interface Locals {\n\t\t\tlocale: string;\n\t\t}",
        ),
      );

      expect(modifyAppDts(file)).toEqual({ status: "success", changed: false });
      expect(unmodifyAppDts(file)).toEqual({
        status: "success",
        changed: false,
      });
    });

    it("says what to add when there is no Locals to find", () => {
      const file = write("app.d.ts", "export {};\n");
      const outcome = modifyAppDts(file);

      expect(outcome.status).toBe("failed");
      expect(read(file)).toBe("export {};\n");
      expect(modifyAppDts(path.join(dir, "missing.d.ts")).status).toBe(
        "not-found",
      );
    });
  });

  describe("+layout.server.ts", () => {
    it("creates the load for a project without one, and takes it back", () => {
      const file = path.join(dir, "+layout.server.ts");

      expect(modifyLayoutServerLocale(file)).toEqual({
        status: "success",
        changed: true,
      });
      expect(read(file)).toContain("return { locale: locals.locale };");

      // Emptied, not removed: the runtime reports it as a delete.
      expect(unmodifyLayoutServerLocale(file)).toEqual({
        status: "success",
        changed: true,
      });
      expect(read(file)).toBe("");
    });

    it("adds locale to what a wrapped load returns", async () => {
      const original = dedent`
        import { loadFlash } from 'sveltekit-flash-message/server';

        export const load = loadFlash(async ({ url }) => {
        	const canonical = url.pathname;

        	return {
        		...tags(canonical)
        	};
        });
      `.concat("\n");
      const file = write("+layout.server.ts", original);

      expect(modifyLayoutServerLocale(file)).toEqual({
        status: "success",
        changed: true,
      });
      const modified = read(file);
      expect(modified).toContain("async ({ locals, url }) =>");
      // After the spread, so nothing spread in shadows it.
      expect(modified).toMatch(/\.\.\.tags\(canonical\),\s+\/\/ Decided/);
      expect(modified).toContain("locale: locals.locale");
      expect(modifyLayoutServerLocale(file)).toEqual({
        status: "success",
        changed: false,
      });

      expect(unmodifyLayoutServerLocale(file).status).toBe("success");
      await expect(read(file)).toMatchFormatted(original, "+layout.server.ts");
    });

    it("reads locals off an event the load takes whole", () => {
      const file = write(
        "+layout.server.ts",
        "export const load = async (event) => {\n\treturn { user: event.locals.user };\n};\n",
      );

      expect(modifyLayoutServerLocale(file).status).toBe("success");
      expect(read(file)).toContain("locale: event.locals.locale");
    });

    it("keeps the locals a load already destructures", async () => {
      const original =
        "export const load = async ({ locals }) => {\n\treturn {\n\t\tuser: locals.user\n\t};\n};\n";
      const file = write("+layout.server.ts", original);

      expect(modifyLayoutServerLocale(file).status).toBe("success");
      expect(read(file)).toContain("async ({ locals }) =>");
      expect(unmodifyLayoutServerLocale(file).status).toBe("success");
      await expect(read(file)).toMatchFormatted(original, "+layout.server.ts");
    });

    it("asks for a hand with a load it cannot add to", () => {
      const original =
        "export const load = async ({ locals }) => {\n\tif (!locals.user) return {};\n\treturn build(locals);\n};\n";
      const file = write("+layout.server.ts", original);

      const outcome = modifyLayoutServerLocale(file);
      expect(outcome.status).toBe("failed");
      expect(outcome.status === "failed" && outcome.message).toContain(
        "locale: locals.locale",
      );
      expect(read(file)).toBe(original);
    });
  });

  describe("hook and layout load, there and back", () => {
    const fixture = (name: string) =>
      fs.readFileSync(
        path.join(__dirname, "fixtures", "original", name),
        "utf8",
      );

    it("takes the handle back out of the hooks.server.ts it composed into", async () => {
      const original = fixture("hooks.server.ts");
      const file = write("hooks.server.ts", original);

      expect(modifyHooksServerI18n(file).status).toBe("success");
      expect(read(file)).toContain("event.locals.locale = locale;");
      expect(unmodifyHooksServerI18n(file)).toEqual({
        status: "success",
        changed: true,
      });
      await expect(read(file)).toMatchFormatted(original, "hooks.server.ts");
    });

    it("empties the hooks.server.ts and +layout.ts it created", () => {
      const hooks = path.join(dir, "hooks.server.ts");
      const layout = path.join(dir, "+layout.ts");
      modifyHooksServerI18n(hooks);
      ensureRootLayoutI18n(layout);

      expect(unmodifyHooksServerI18n(hooks).status).toBe("success");
      expect(read(hooks).trim()).toBe("");
      expect(unmodifyRootLayoutI18n(layout).status).toBe("success");
      expect(read(layout)).toBe("");
    });
  });

  // The rule itself ships as src/lib/locale.ts. Loaded by path: the template
  // imports a type from the project's #locales, which this repo does not have.
  describe("the locale rule the project gets", () => {
    const locales = ["en", "es"] as const;
    const base = {
      urlLocale: null,
      localizedUrl: false,
      cookie: undefined,
      acceptLanguage: null,
      locales,
      defaultLocale: "en",
    };
    const rule = () =>
      import(
        /* @vite-ignore */ path.join(__dirname, "../creates/src/lib/locale.ts")
      );

    it("takes the most preferred Accept-Language the site has", async () => {
      const { acceptedLocale } = await rule();
      expect(
        acceptedLocale("fr-FR,fr;q=0.9,es-GT;q=0.8,en;q=0.7", locales),
      ).toBe("es");
      expect(acceptedLocale("en;q=0.5, es;q=0.9", locales)).toBe("es");
      expect(acceptedLocale("fr,de;q=0.8", locales)).toBeNull();
      expect(acceptedLocale("es;q=0", locales)).toBeNull();
      expect(acceptedLocale(null, locales)).toBeNull();
    });

    it("lets the URL decide on public pages", async () => {
      const { pickLocale } = await rule();
      expect(
        pickLocale({
          ...base,
          urlLocale: "es",
          localizedUrl: true,
          cookie: "en",
        }),
      ).toBe("es");
      expect(
        pickLocale({
          ...base,
          localizedUrl: true,
          cookie: "es",
          acceptLanguage: "es",
        }),
      ).toBe("en");
    });

    it("follows the cookie, then the browser, elsewhere", async () => {
      const { pickLocale } = await rule();
      expect(pickLocale({ ...base, cookie: "es", acceptLanguage: "en" })).toBe(
        "es",
      );
      expect(
        pickLocale({ ...base, cookie: "xx", acceptLanguage: "es-GT" }),
      ).toBe("es");
      expect(pickLocale(base)).toBe("en");
    });
  });

  describe("signed-in layout", () => {
    it("puts the language select at the end of the header", () => {
      const original = fs.readFileSync(authLayout, "utf8");
      const file = write("+layout.svelte", original);

      expect(modifyAppLayoutLanguageSelect(file)).toEqual({
        status: "success",
        changed: true,
      });
      const modified = read(file);
      expect(modified).toContain(
        "import LanguageSelect from '#lib/components/language-select.svelte';",
      );
      expect(modified).toMatch(
        /<div class="ml-auto px-4">\s*<LanguageSelect \/>\s*<\/div>\s*<\/header>/,
      );
      expect(modifyAppLayoutLanguageSelect(file)).toEqual({
        status: "success",
        changed: false,
      });

      expect(unmodifyAppLayoutLanguageSelect(file)).toEqual({
        status: "success",
        changed: true,
      });
      expect(read(file)).toBe(original);
    });

    it("leaves a project without the layout alone", () => {
      const file = path.join(dir, "+layout.svelte");
      expect(modifyAppLayoutLanguageSelect(file)).toEqual({
        status: "success",
        changed: false,
      });
      expect(fs.existsSync(file)).toBe(false);
    });

    it("says where the select goes when the layout has no header", () => {
      const file = write(
        "+layout.svelte",
        '<script lang="ts">\n\tlet { children } = $props();\n</script>\n\n{@render children?.()}\n',
      );
      expect(modifyAppLayoutLanguageSelect(file).status).toBe("failed");
    });
  });
});
