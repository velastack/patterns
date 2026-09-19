import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const patternsDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Directories whose files end up in a project or on the website preview.
 * Fixtures are test inputs and may model a project from before `$lib/site`.
 */
const SHIPPED = /^(creates[^/]*|variants|providers|preview-modifies)$/;

/** PocketBase meta as the app's name and URL, which `$lib/site` replaced. */
const META_READ = /\b(?:locals|data)\??\.meta\b|\bmeta\??\.app(?:Name|URL)\b/;

function shippedFiles(dir: string, shipped = false): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "fixtures" || entry.name === "node_modules") continue;
      files.push(...shippedFiles(full, shipped || SHIPPED.test(entry.name)));
    } else if (shipped) {
      files.push(full);
    }
  }
  return files;
}

describe("app name and URL", () => {
  it("come from $lib/site in every file a pattern ships", () => {
    const offenders = shippedFiles(patternsDir)
      .filter((file) => META_READ.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(patternsDir, file));
    expect(offenders).toEqual([]);
  });
});
