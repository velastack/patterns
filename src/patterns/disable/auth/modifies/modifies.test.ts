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
    // The auth menu's imports were last; the blank line setting the props
    // declaration off from the import block is not theirs to take.
    expect(reverted).toContain(
      "import { Button } from '$lib/components/ui/button';\n\n\tlet { children }",
    );
  });
});
