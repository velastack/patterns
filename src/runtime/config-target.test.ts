import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveConfigTarget } from "./config-target";
import { modifySvelteConfigRemote } from "./modify-svelte-config-remote";
import { modifySvelteConfig as modifyI18nAlias } from "../patterns/enable/i18n/modifies/svelte-config";
import { modifySvelteConfigMdsvex } from "../patterns/enable/blog/modifies/svelte.config";
import {
  modifySvelteConfig as modifyBackendAdapter,
  unmodifySvelteConfig,
} from "../patterns/enable/backend/modifies/svelte-config";

const tmpRoots: string[] = [];

afterEach(() => {
  while (tmpRoots.length) {
    fs.rmSync(tmpRoots.pop()!, { recursive: true, force: true });
  }
});

function makeRoot(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vela-config-target-"));
  tmpRoots.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const abs = path.join(dir, name);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  return dir;
}

const read = (root: string, name: string) =>
  fs.readFileSync(path.join(root, name), "utf8");

const VITE_INLINE = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({})]
});
`;

const VITE_BARE = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()]
});
`;

const VITE_NO_SVELTEKIT = `import { defineConfig } from 'vite';

export default defineConfig({
	plugins: []
});
`;

const VITE_NONOBJECT_ARG = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const opts = {};

export default defineConfig({
	plugins: [sveltekit(opts)]
});
`;

const SVELTE_CONFIG = `import adapter from '@sveltejs/adapter-auto';

const config = {
	kit: {
		adapter: adapter()
	}
};

export default config;
`;

const VITE_INLINE_ADAPTER_STATIC = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-static';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter({ fallback: '200.html' }) })]
});
`;

const VITE_INLINE_ADAPTER_AUTO = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-auto';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter() })]
});
`;

describe("resolveConfigTarget precedence", () => {
  it("rule 1: inline sveltekit() arg wins even when svelte.config exists", () => {
    const root = makeRoot({
      "vite.config.ts": VITE_INLINE,
      "svelte.config.js": SVELTE_CONFIG,
    });
    const res = resolveConfigTarget(root);
    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.target.kind).toBe("vite-inline");
      expect(res.target.filePath.endsWith("vite.config.ts")).toBe(true);
    }
  });

  it("rule 2: svelte.config when vite has only a bare sveltekit()", () => {
    const root = makeRoot({
      "vite.config.ts": VITE_BARE,
      "svelte.config.js": SVELTE_CONFIG,
    });
    const res = resolveConfigTarget(root);
    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.target.kind).toBe("svelte-config");
    }
  });

  it("rule 2: svelte.config when there is no vite config", () => {
    const root = makeRoot({ "svelte.config.js": SVELTE_CONFIG });
    const res = resolveConfigTarget(root);
    expect(res.status === "resolved" && res.target.kind).toBe("svelte-config");
  });

  it("rule 3: bare sveltekit() and no svelte.config creates a vite-inline arg", () => {
    const root = makeRoot({ "vite.config.ts": VITE_BARE });
    const res = resolveConfigTarget(root);
    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.target.kind).toBe("vite-inline");
    }
  });

  it("not-found when there is no svelte config and no sveltekit() call", () => {
    const root = makeRoot({ "vite.config.ts": VITE_NO_SVELTEKIT });
    expect(resolveConfigTarget(root).status).toBe("not-found");
  });

  it("not-found on an empty project", () => {
    const root = makeRoot({});
    expect(resolveConfigTarget(root).status).toBe("not-found");
  });

  it("failed for a non-object sveltekit() arg with no svelte.config", () => {
    const root = makeRoot({ "vite.config.ts": VITE_NONOBJECT_ARG });
    expect(resolveConfigTarget(root).status).toBe("failed");
  });

  it("non-object sveltekit() arg falls back to svelte.config when present", () => {
    const root = makeRoot({
      "vite.config.ts": VITE_NONOBJECT_ARG,
      "svelte.config.js": SVELTE_CONFIG,
    });
    const res = resolveConfigTarget(root);
    expect(res.status === "resolved" && res.target.kind).toBe("svelte-config");
  });
});

describe("modifiers target the resolved config", () => {
  it("remote functions land in the vite-inline sveltekit() arg", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE });
    const { filePath, outcome } = modifySvelteConfigRemote(root);
    expect(outcome).toEqual({ status: "success", changed: true });
    expect(filePath.endsWith("vite.config.ts")).toBe(true);
    const vite = read(root, "vite.config.ts");
    expect(vite).toMatch(/remoteFunctions:\s*true/);
    expect(vite).toMatch(/compilerOptions/);
    expect(vite).toMatch(/async:\s*true/);
  });

  it("remote functions land in svelte.config when that's the only config", () => {
    const root = makeRoot({ "svelte.config.js": SVELTE_CONFIG });
    const { filePath, outcome } = modifySvelteConfigRemote(root);
    expect(outcome).toEqual({ status: "success", changed: true });
    expect(filePath.endsWith("svelte.config.js")).toBe(true);
    const svelte = read(root, "svelte.config.js");
    expect(svelte).toMatch(/remoteFunctions:\s*true/);
    expect(svelte).toMatch(/async:\s*true/);
  });

  it("with both present, vite-inline is modified and svelte.config is untouched", () => {
    const root = makeRoot({
      "vite.config.ts": VITE_INLINE,
      "svelte.config.js": SVELTE_CONFIG,
    });
    const { filePath } = modifySvelteConfigRemote(root);
    expect(filePath.endsWith("vite.config.ts")).toBe(true);
    expect(read(root, "svelte.config.js")).toBe(SVELTE_CONFIG);
    expect(read(root, "vite.config.ts")).toMatch(/remoteFunctions:\s*true/);
  });

  it("remote modification is idempotent", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE });
    modifySvelteConfigRemote(root);
    const first = read(root, "vite.config.ts");
    const second = modifySvelteConfigRemote(root);
    expect(second.outcome).toEqual({ status: "success", changed: false });
    expect(read(root, "vite.config.ts")).toBe(first);
  });

  it("i18n alias lands in the vite-inline arg", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE });
    const { outcome } = modifyI18nAlias(root);
    expect(outcome).toEqual({ status: "success", changed: true });
    expect(read(root, "vite.config.ts")).toMatch(/\$locales:\s*'src\/locales'/);
  });

  it("mdsvex extensions/preprocess/import land in the vite-inline arg", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE });
    const { outcome } = modifySvelteConfigMdsvex(root);
    expect(outcome.status).toBe("success");
    const vite = read(root, "vite.config.ts");
    expect(vite).toMatch(/extensions/);
    expect(vite).toContain(".svx");
    expect(vite).toMatch(/preprocess/);
    expect(vite).toMatch(/mdsvex\(\)/);
    expect(vite).toMatch(/from\s+'mdsvex'/);
  });

  it("backend switches the adapter to adapter-auto in vite.config", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE_ADAPTER_STATIC });
    const { outcome } = modifyBackendAdapter(root);
    expect(outcome.status).toBe("success");
    const vite = read(root, "vite.config.ts");
    expect(vite).toContain("@sveltejs/adapter-auto");
    expect(vite).not.toContain("@sveltejs/adapter-static");
    expect(vite).not.toContain("fallback");
  });

  it("disable backend reverts the adapter to adapter-static in vite.config", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE_ADAPTER_AUTO });
    const { outcome } = unmodifySvelteConfig(root);
    expect(outcome.status).toBe("success");
    const vite = read(root, "vite.config.ts");
    expect(vite).toContain("@sveltejs/adapter-static");
    expect(vite).toContain("fallback");
  });

  it("disable backend is a no-op when there is no config", () => {
    const root = makeRoot({});
    expect(unmodifySvelteConfig(root).outcome).toEqual({
      status: "success",
      changed: false,
    });
  });
});
