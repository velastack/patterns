import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ensureBooleanTrue,
  modifyConfig,
  resolveConfigTarget,
  SVELTE_CONFIG_MESSAGE,
} from "./config-target";
import { modifySvelteConfigRemote } from "./modify-svelte-config-remote";
import { modifyViteConfigMdsvex } from "../patterns/enable/blog/modifies/vite-config";
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

const VITE_INLINE_ADAPTER_NODE = VITE_INLINE_ADAPTER_AUTO.replace(
  "@sveltejs/adapter-auto",
  "@sveltejs/adapter-node",
);

const VITE_KIT_NESTING = `import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ kit: { adapter: adapter() } })]
});
`;

describe("resolveConfigTarget", () => {
  it("resolves the inline sveltekit() arg", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE });
    const res = resolveConfigTarget(root);
    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.target.filePath.endsWith("vite.config.ts")).toBe(true);
      expect(res.target.configObject.getText()).toBe("{}");
    }
  });

  it("adds {} to a bare sveltekit()", () => {
    const root = makeRoot({ "vite.config.ts": VITE_BARE });
    const res = resolveConfigTarget(root);
    expect(res.status).toBe("resolved");
    if (res.status === "resolved") {
      expect(res.target.configObject.getText()).toBe("{}");
      expect(res.target.sourceFile.getFullText()).toContain("sveltekit({})");
    }
  });

  it("fails with the migrate message when a svelte.config exists", () => {
    const root = makeRoot({
      "vite.config.ts": VITE_BARE,
      "svelte.config.js": SVELTE_CONFIG,
    });
    const res = resolveConfigTarget(root);
    expect(res).toMatchObject({
      status: "failed",
      reason: "svelte-config",
      message: SVELTE_CONFIG_MESSAGE,
    });
    expect(res.status !== "resolved" && res.filePath).toMatch(
      /svelte\.config\.js$/,
    );
    expect(SVELTE_CONFIG_MESSAGE).toContain(
      "npx vela@^0.15 migrate sveltekit-3",
    );
  });

  it("fails on a svelte.config even when the inline arg exists too", () => {
    const root = makeRoot({
      "vite.config.ts": VITE_INLINE,
      "svelte.config.ts": SVELTE_CONFIG,
    });
    expect(resolveConfigTarget(root)).toMatchObject({
      status: "failed",
      reason: "svelte-config",
    });
  });

  it("fails on a svelte.config with no vite config", () => {
    const root = makeRoot({ "svelte.config.js": SVELTE_CONFIG });
    expect(resolveConfigTarget(root)).toMatchObject({
      status: "failed",
      reason: "svelte-config",
    });
  });

  it("fails on options still nested under kit:", () => {
    const root = makeRoot({ "vite.config.ts": VITE_KIT_NESTING });
    expect(resolveConfigTarget(root)).toMatchObject({
      status: "failed",
      reason: "kit-nesting",
    });
  });

  it("fails on a non-object sveltekit() arg", () => {
    const root = makeRoot({ "vite.config.ts": VITE_NONOBJECT_ARG });
    expect(resolveConfigTarget(root)).toMatchObject({
      status: "failed",
      reason: "non-object-arg",
    });
  });

  it("not-found when the vite config has no sveltekit() call", () => {
    const root = makeRoot({ "vite.config.ts": VITE_NO_SVELTEKIT });
    expect(resolveConfigTarget(root).status).toBe("not-found");
  });

  it("not-found on an empty project", () => {
    const root = makeRoot({});
    expect(resolveConfigTarget(root).status).toBe("not-found");
  });
});

describe("modifyConfig", () => {
  const HINTS = { notFound: "not found", failed: "failed" };

  it("leaves a bare sveltekit() untouched when the mutator adds nothing", () => {
    const root = makeRoot({ "vite.config.ts": VITE_BARE });
    const { outcome } = modifyConfig(root, HINTS, () => true);
    expect(outcome).toEqual({ status: "success", changed: false });
    expect(read(root, "vite.config.ts")).toBe(VITE_BARE);
  });

  it("keeps the {} it adds to a bare sveltekit() once something goes in", () => {
    const root = makeRoot({ "vite.config.ts": VITE_BARE });
    const { outcome } = modifyConfig(root, HINTS, (target) =>
      ensureBooleanTrue(target.configObject, "experimental"),
    );
    expect(outcome).toEqual({ status: "success", changed: true });
    expect(read(root, "vite.config.ts")).toMatch(
      /sveltekit\(\{\s*experimental: true\s*\}\)/,
    );
  });

  it("keeps an inline {} the project wrote itself", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE });
    const { outcome } = modifyConfig(root, HINTS, () => true);
    expect(outcome).toEqual({ status: "success", changed: false });
    expect(read(root, "vite.config.ts")).toBe(VITE_INLINE);
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

  it("a svelte.config fails the modifier and is left untouched", () => {
    const root = makeRoot({
      "vite.config.ts": VITE_INLINE,
      "svelte.config.js": SVELTE_CONFIG,
    });
    const { filePath, outcome } = modifySvelteConfigRemote(root);
    expect(outcome).toEqual({
      status: "failed",
      message: SVELTE_CONFIG_MESSAGE,
    });
    expect(filePath.endsWith("svelte.config.js")).toBe(true);
    expect(read(root, "svelte.config.js")).toBe(SVELTE_CONFIG);
    expect(read(root, "vite.config.ts")).toBe(VITE_INLINE);
  });

  it("remote modification is idempotent", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE });
    modifySvelteConfigRemote(root);
    const first = read(root, "vite.config.ts");
    const second = modifySvelteConfigRemote(root);
    expect(second.outcome).toEqual({ status: "success", changed: false });
    expect(read(root, "vite.config.ts")).toBe(first);
  });

  it("mdsvex extensions/preprocess/import land in the vite-inline arg", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE });
    const { outcome } = modifyViteConfigMdsvex(root);
    expect(outcome.status).toBe("success");
    const vite = read(root, "vite.config.ts");
    expect(vite).toMatch(/extensions/);
    expect(vite).toContain(".svx");
    expect(vite).toMatch(/preprocess/);
    expect(vite).toMatch(/mdsvex\(\)/);
    expect(vite).toMatch(/from\s+'mdsvex'/);
  });

  it("backend switches the adapter to adapter-node in vite.config", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE_ADAPTER_STATIC });
    const { outcome } = modifyBackendAdapter(root);
    expect(outcome.status).toBe("success");
    const vite = read(root, "vite.config.ts");
    expect(vite).toContain("@sveltejs/adapter-node");
    expect(vite).not.toContain("@sveltejs/adapter-static");
    expect(vite).not.toContain("fallback");
  });

  it("backend also moves a project off adapter-auto, which never chose", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE_ADAPTER_AUTO });
    const { outcome } = modifyBackendAdapter(root);
    expect(outcome.status).toBe("success");
    expect(read(root, "vite.config.ts")).toContain("@sveltejs/adapter-node");
  });

  it("backend leaves a project already on adapter-node unchanged", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE_ADAPTER_NODE });
    const { outcome } = modifyBackendAdapter(root);
    expect(outcome.status).toBe("success");
    const vite = read(root, "vite.config.ts");
    expect(vite).toContain("@sveltejs/adapter-node");
    expect(vite).not.toMatch(/adapter-(auto|static)/);
  });

  it("disable backend reverts the adapter to adapter-static in vite.config", () => {
    const root = makeRoot({ "vite.config.ts": VITE_INLINE_ADAPTER_NODE });
    const { outcome } = unmodifySvelteConfig(root);
    expect(outcome.status).toBe("success");
    const vite = read(root, "vite.config.ts");
    expect(vite).toContain("@sveltejs/adapter-static");
    expect(vite).toContain("fallback");
  });

  it("disable backend fails on a svelte.config rather than skipping it", () => {
    const root = makeRoot({ "svelte.config.js": SVELTE_CONFIG });
    expect(unmodifySvelteConfig(root).outcome).toEqual({
      status: "failed",
      message: SVELTE_CONFIG_MESSAGE,
    });
  });

  it("disable backend is a no-op when there is no config", () => {
    const root = makeRoot({});
    expect(unmodifySvelteConfig(root).outcome).toEqual({
      status: "success",
      changed: false,
    });
  });
});
