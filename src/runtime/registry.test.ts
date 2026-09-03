import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RegistryUnavailableError } from "../core/errors";
import {
  DEFAULT_CSS_PATH,
  DEFAULT_REGISTRY,
  DEFAULT_STYLE,
  fetchRegistryIndex,
  readComponentsConfig,
  registryIndexUrl,
} from "./registry";
import { offlineFetch, registryFetch, registryItems } from "./registry.mock";

const tempDirs: string[] = [];

function makeProject(config?: unknown): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "registry-"));
  tempDirs.push(root);
  if (config !== undefined) {
    writeFileSync(
      path.join(root, "components.json"),
      typeof config === "string" ? config : JSON.stringify(config),
      "utf8",
    );
  }
  return root;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("readComponentsConfig", () => {
  it("fills in shadcn-svelte's defaults for a missing or unreadable file", () => {
    const expected = {
      style: DEFAULT_STYLE,
      registry: DEFAULT_REGISTRY,
      aliases: {},
      cssPath: DEFAULT_CSS_PATH,
    };
    expect(readComponentsConfig(makeProject())).toMatchObject(expected);
    expect(readComponentsConfig(makeProject("{ not json"))).toMatchObject(
      expected,
    );
    // No `style` means nova to shadcn-svelte, not vega.
    expect(readComponentsConfig(makeProject({})).style).toBe("nova");
  });

  it("reads what the templates write", () => {
    const root = makeProject({
      style: "vega",
      tailwind: { css: "src/styles/app.css", baseColor: "zinc" },
      aliases: { ui: "$lib/components/ui", utils: "$lib/utils" },
      registry: "https://r.example/registry",
      iconLibrary: "lucide",
      menuColor: "inverted",
      menuAccent: "bold",
    });
    expect(readComponentsConfig(root)).toEqual({
      style: "vega",
      registry: "https://r.example/registry",
      baseColor: "zinc",
      iconLibrary: "lucide",
      menuColor: "inverted",
      menuAccent: "bold",
      aliases: { ui: "$lib/components/ui", utils: "$lib/utils" },
      cssPath: "src/styles/app.css",
    });
  });

  it("ignores values of the wrong type", () => {
    const root = makeProject({
      style: 3,
      tailwind: { baseColor: null },
      aliases: { ui: ["$lib"] },
    });
    const config = readComponentsConfig(root);
    expect(config.style).toBe(DEFAULT_STYLE);
    expect(config.baseColor).toBeUndefined();
    expect(config.aliases).toEqual({});
  });
});

describe("registryIndexUrl", () => {
  it("builds the style-scoped index URL", () => {
    expect(registryIndexUrl("https://shadcn-svelte.com/registry", "vega")).toBe(
      "https://shadcn-svelte.com/registry/styles/vega/index.json",
    );
    expect(registryIndexUrl("https://r.example/reg/", "nova")).toBe(
      "https://r.example/reg/styles/nova/index.json",
    );
  });
});

describe("fetchRegistryIndex", () => {
  it("reads the configured style's index and keeps only named, typed items", async () => {
    const root = makeProject({ style: "vega" });
    const calls: string[] = [];
    const fetch = registryFetch(
      [
        "button",
        { name: "dashboard-01", type: "registry:block" },
        { name: 5, type: "registry:ui" } as never,
        { name: "untyped" } as never,
      ],
      calls,
    );

    const items = await fetchRegistryIndex(root, { runtime: { fetch } });

    expect(calls).toEqual([
      "https://shadcn-svelte.com/registry/styles/vega/index.json",
    ]);
    expect(items).toEqual(
      registryItems([
        "button",
        { name: "dashboard-01", type: "registry:block" },
      ]),
    );
  });

  it("looks at another style on request", async () => {
    const root = makeProject({ style: "vega" });
    const calls: string[] = [];
    await fetchRegistryIndex(root, {
      style: "nova",
      runtime: { fetch: registryFetch(["button"], calls) },
    });
    expect(calls).toEqual([
      "https://shadcn-svelte.com/registry/styles/nova/index.json",
    ]);
  });

  it("asks once per URL for the same fetch", async () => {
    const root = makeProject({ style: "vega" });
    const calls: string[] = [];
    const fetch = registryFetch(["button"], calls);

    await fetchRegistryIndex(root, { runtime: { fetch } });
    await fetchRegistryIndex(root, { runtime: { fetch } });
    await fetchRegistryIndex(root, { style: "nova", runtime: { fetch } });

    expect(calls).toHaveLength(2);
  });

  it("reports an unreachable registry with the URL, and retries next time", async () => {
    const root = makeProject({ style: "vega" });
    let attempts = 0;
    const failing = (async () => {
      attempts++;
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(
      fetchRegistryIndex(root, { runtime: { fetch: failing } }),
    ).rejects.toThrow(
      new RegistryUnavailableError(
        "https://shadcn-svelte.com/registry/styles/vega/index.json",
        "fetch failed",
      ),
    );
    await expect(
      fetchRegistryIndex(root, { runtime: { fetch: failing } }),
    ).rejects.toBeInstanceOf(RegistryUnavailableError);
    expect(attempts).toBe(2);
  });

  it("treats an HTTP error and a malformed index as unavailable", async () => {
    const root = makeProject({ style: "vega" });
    const forbidden = (async () =>
      new Response("nope", { status: 403 })) as unknown as typeof fetch;
    await expect(
      fetchRegistryIndex(root, { runtime: { fetch: forbidden } }),
    ).rejects.toThrow("HTTP 403");

    const html = (async () =>
      new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    await expect(
      fetchRegistryIndex(root, { runtime: { fetch: html } }),
    ).rejects.toBeInstanceOf(RegistryUnavailableError);

    const object = (async () =>
      new Response("{}", { status: 200 })) as unknown as typeof fetch;
    await expect(
      fetchRegistryIndex(root, { runtime: { fetch: object } }),
    ).rejects.toThrow("the index is not a list");

    await expect(
      fetchRegistryIndex(root, { runtime: { fetch: offlineFetch() } }),
    ).rejects.toBeInstanceOf(RegistryUnavailableError);
  });
});
