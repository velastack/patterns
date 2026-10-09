import fs from "node:fs";
import path from "node:path";
import prettier from "prettier";
import sveltePlugin from "prettier-plugin-svelte";
import type { ModifyOutcome } from "../../../../core/types";

/** A stock version of a file, and what it becomes. */
export interface Candidate {
  original: string;
  template: string;
}

/**
 * Another pattern's edit to the file that the swap carries over: `strip`
 * takes it out of the normalized source to compare that against the
 * originals, `apply` puts it back into the written template.
 */
export interface Overlay {
  /** Whether the current file has the edit. */
  detect: (content: string) => boolean;
  /** Gets the normalized source (prettier defaults), returns it without the edit. */
  strip: (normalized: string) => string;
  apply: (filePath: string) => ModifyOutcome;
}

/** One file of a group, and the swap decided for it. */
export interface Planned {
  filePath: string;
  outcome:
    | { kind: "write"; template: string; overlay?: Overlay }
    | { kind: "done" }
    | { kind: "missing" }
    | { kind: "customized" };
}

/**
 * Reprints a source with fixed settings, so the project's own prettier
 * config (tabs, quotes, print width) does not count as a change. Content
 * prettier cannot parse is compared as is.
 */
async function normalize(content: string, filePath: string): Promise<string> {
  try {
    return await prettier.format(content, {
      filepath: filePath,
      plugins: [sveltePlugin],
    });
  } catch {
    return content;
  }
}

/**
 * Decides what to do with one file: `write` the template of the stock
 * original it still matches, `done` when it already has `marker`, else
 * `customized`. A file with an overlay's edit is compared without it.
 */
export async function planFile(
  filePath: string,
  candidates: Candidate[],
  marker: RegExp,
  overlays: Overlay[] = [],
): Promise<Planned> {
  if (!fs.existsSync(filePath)) {
    return { filePath, outcome: { kind: "missing" } };
  }
  const current = fs.readFileSync(filePath, "utf8");
  if (marker.test(current)) {
    return { filePath, outcome: { kind: "done" } };
  }

  let normalized = await normalize(current, filePath);
  const overlay = overlays.find((candidate) => candidate.detect(current));
  if (overlay) normalized = overlay.strip(normalized);

  for (const { original, template } of candidates) {
    if ((await normalize(original, filePath)) === normalized) {
      return { filePath, outcome: { kind: "write", template, overlay } };
    }
  }
  return { filePath, outcome: { kind: "customized" } };
}

/**
 * Applies a group of planned swaps (a page with its server code and schema)
 * all or nothing: one customized or missing file leaves the whole group as
 * it is, since half a swap would not type-check.
 */
export function applyGroup(
  planned: Planned[],
  hint: (filePath: string) => string,
): Map<string, ModifyOutcome> {
  const outcomes = new Map<string, ModifyOutcome>();
  const blocked = planned.filter(
    (p) => p.outcome.kind === "customized" || p.outcome.kind === "missing",
  );

  for (const { filePath, outcome } of planned) {
    if (outcome.kind === "missing") {
      outcomes.set(filePath, { status: "not-found", message: hint(filePath) });
    } else if (outcome.kind === "customized") {
      outcomes.set(filePath, { status: "failed", message: hint(filePath) });
    } else if (outcome.kind === "done") {
      outcomes.set(filePath, { status: "success", changed: false });
    } else if (blocked.length > 0) {
      const others = blocked
        .map(
          (p) =>
            path.basename(path.dirname(p.filePath)) +
            "/" +
            path.basename(p.filePath),
        )
        .join(", ");
      outcomes.set(filePath, {
        status: "failed",
        message: `Left as is, along with ${others}, which has changes of its own.\n${hint(filePath)}`,
      });
    } else {
      fs.writeFileSync(filePath, outcome.template, "utf8");
      outcome.overlay?.apply(filePath);
      outcomes.set(filePath, { status: "success", changed: true });
    }
  }
  return outcomes;
}
