import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = dedent`
  src/routes/+layout.server.ts still reads locals.meta, which only the
  PocketBase hook provides. Read the values from a static module instead:

  import { site } from '$lib/site';

  // locals.meta.appName -> site.name
  // locals.meta.appURL  -> site.url
  // meta: locals.meta   -> meta: { appName: site.name, appURL: site.url }
`;

/**
 * Point the root layout's meta at `$lib/site` instead of `locals.meta`. The
 * minimal template reads app name and URL off the PocketBase hook; without
 * the backend nothing sets them, and `App.Locals` no longer declares them.
 */
export function unmodifyLayoutServerMeta(
  layoutServerPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutServerPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(layoutServerPath, "utf8");
  if (!original.includes("locals.meta")) {
    return { status: "success", changed: false };
  }

  let updated = original
    .replace(/\blocals\.meta\.appName\b/g, "site.name")
    .replace(/\blocals\.meta\.appURL\b/g, "site.url")
    .replace(
      /\bmeta:\s*locals\.meta\b/g,
      "meta: { appName: site.name, appURL: site.url }",
    );

  if (updated.includes("locals.meta")) {
    return { status: "failed", message: FAILURE_HINT };
  }

  // `locals` usually only carried meta; drop it from the destructuring when
  // nothing else reads it.
  const withoutParam = updated
    .replace(/\(\{\s*locals\s*,\s*/g, "({ ")
    .replace(/,\s*locals\s*\}/g, " }");
  if (!/\blocals\b/.test(withoutParam)) {
    updated = withoutParam;
  }

  if (!/from\s+['"]\$lib\/site['"]/.test(updated)) {
    updated = "import { site } from '$lib/site';\n" + updated;
  }

  fs.writeFileSync(layoutServerPath, updated, "utf8");
  return { status: "success", changed: true };
}
