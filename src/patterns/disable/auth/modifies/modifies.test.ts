import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modifyLayoutServer } from "../../../enable/auth/modifies/+layout.server";
import { modifyRootLayoutSvelte } from "../../../enable/auth/modifies/root-layout.svelte";
import { unmodifyLayoutServer } from "./+layout.server";
import { unmodifyRootLayoutSvelte } from "./root-layout.svelte";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// enable-auth's inputs are the template files this pattern reverts to.
const originals = path.join(
  __dirname,
  "../../../enable/auth/modifies/fixtures/original",
);
const tempDir = path.join(__dirname, "temp");

describe("disable-auth reverts enable-auth", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(originals, tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("drops the locals binding enable-auth added to the root layout", () => {
    // The template's `load` takes `url` alone; enable-auth adds `locals` for
    // `user`, and nothing else uses it once `user` is gone.
    const file = path.join(tempDir, "root-layout.server.ts");
    modifyLayoutServer(file);
    expect(fs.readFileSync(file, "utf8")).toContain("async ({ locals, url })");

    expect(unmodifyLayoutServer(file)).toMatchObject({ status: "success" });
    const reverted = fs.readFileSync(file, "utf8");
    expect(reverted).toContain("async ({ url })");
    expect(reverted).not.toContain("locals");
  });

  it("drops the data prop the auth menu needed", () => {
    const file = path.join(tempDir, "basic-layout.svelte");
    modifyRootLayoutSvelte(file);
    expect(fs.readFileSync(file, "utf8")).toContain("let { children, data }");

    expect(unmodifyRootLayoutSvelte(file)).toMatchObject({
      status: "success",
    });
    const reverted = fs.readFileSync(file, "utf8");
    expect(reverted).toContain(
      "let { children }: { children?: Snippet; data?: any } = $props();",
    );
    expect(reverted).not.toContain("data.user");
  });

  it.each(["basic-layout.svelte", "wrapped-layout.svelte"])(
    "takes the nav item the menu lived in with it (%s)",
    (fixture) => {
      const file = path.join(tempDir, fixture);
      modifyRootLayoutSvelte(file);

      expect(unmodifyRootLayoutSvelte(file)).toMatchObject({
        status: "success",
      });
      const reverted = fs.readFileSync(file, "utf8");
      expect(reverted).not.toContain("AuthMenu");
      // The wrapper enable-auth added would otherwise be left behind empty,
      // rendering as a stray gap in the navbar.
      expect(reverted).not.toMatch(/<Navbar\.Item[^>]*>\s*<\/Navbar\.Item>/);
      // The navbar's own items stay put.
      expect(reverted).toContain("Home");
    },
  );

  it("keeps a nav item that holds something else", () => {
    const file = path.join(tempDir, "basic-layout.svelte");
    modifyRootLayoutSvelte(file);
    // A developer dropped their own button alongside the menu.
    fs.writeFileSync(
      file,
      fs
        .readFileSync(file, "utf8")
        .replace(
          "<AuthMenu.Root>",
          '<Button href="/help">Help</Button>\n\t\t\t<AuthMenu.Root>',
        ),
      "utf8",
    );

    expect(unmodifyRootLayoutSvelte(file)).toMatchObject({
      status: "success",
    });
    const reverted = fs.readFileSync(file, "utf8");
    expect(reverted).not.toContain("AuthMenu");
    expect(reverted).toContain('<Button href="/help">Help</Button>');
  });
});
