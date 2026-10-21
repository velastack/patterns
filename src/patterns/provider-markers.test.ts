import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { capabilityName, providerMarkers } from "../core/providers";
import type { Pattern } from "../core/types";
import { envVarsFile } from "../runtime/env-vars-file";
import { detectProviders, patterns } from "../index";

/**
 * Nothing records which provider a project chose, so each one has to leave
 * something only it leaves. Inheriting patterns are exempt: their provider is
 * whatever the capability they build on detected.
 */
const registry: readonly Pattern[] = patterns;
const detectable = registry.filter(
  (pattern) => pattern.providers?.length && !pattern.inheritsProvider,
);

const roots: string[] = [];

afterEach(() => {
  while (roots.length) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

describe("provider markers", () => {
  it("covers at least the patterns that declare providers today", () => {
    expect(detectable.map((pattern) => pattern.slug)).toEqual(
      expect.arrayContaining(["enable-ai", "enable-analytics"]),
    );
  });

  for (const pattern of detectable) {
    describe(pattern.slug, () => {
      const providers = pattern.providers ?? [];

      it("gives every provider a marker", () => {
        for (const provider of providers) {
          expect(providerMarkers(provider), provider.id).not.toEqual([]);
        }
      });

      it("gives no two providers the same marker", () => {
        const seen = new Map<string, string>();
        for (const provider of providers) {
          for (const marker of providerMarkers(provider)) {
            const key = JSON.stringify(marker);
            expect(seen.get(key), `${provider.id} ${key}`).toBeUndefined();
            seen.set(key, provider.id);
          }
        }
      });

      it("detects each provider from its declared env alone", async () => {
        for (const provider of providers) {
          const env = providerMarkers(provider).find(
            (marker) => "env" in marker,
          );
          if (!env || !("env" in env)) continue;

          const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-markers-"));
          roots.push(root);
          fs.mkdirSync(path.join(root, "src"));
          fs.writeFileSync(
            path.join(root, "src/env.ts"),
            envVarsFile([{ name: env.env }]),
          );

          const detected = await detectProviders(root);
          expect(detected.providers[capabilityName(pattern.slug)]).toBe(
            provider.id,
          );
        }
      });
    });
  }
});
