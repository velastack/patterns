import fs from "node:fs";
import path from "node:path";
import type { ModifyOutcome } from "../../../../core/types";
import { modifyUserSignup } from "../../payments/modifies/modify-user-signup";
import {
  applyGroup,
  planFile,
  type Candidate,
  type Overlay,
} from "./modify-by-original";

/**
 * The login and signup pages as enable-auth writes them, and with WhatsApp.
 * The stock files come straight from the auth patterns, so a change there
 * that is not mirrored in `templates/` fails the tests instead of drifting.
 */
const raw = (glob: Record<string, string>, prefix: string) =>
  Object.fromEntries(
    Object.entries(glob).map(([key, content]) => [
      key.slice(prefix.length),
      content,
    ]),
  );

const STOCK = {
  base: raw(
    import.meta.glob<string>("../../auth/creates/src/**", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
    "../../auth/creates/",
  ),
  split: raw(
    import.meta.glob<string>("../../auth/variants/split/src/**", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
    "../../auth/variants/split/",
  ),
  remote: raw(
    import.meta.glob<string>("../../auth-remote/creates/src/**", {
      query: "?raw",
      import: "default",
      eager: true,
    }),
    "../../auth-remote/creates/",
  ),
};

/** The pages enable-auth 1.1 wrote, before signup had a one-time code. */
const LEGACY = raw(
  import.meta.glob<string>("../originals/**", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  "../originals/auth-1.1/",
);

const TEMPLATES = raw(
  import.meta.glob<string>("../templates/**", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  "../templates/",
);

type Shape = "base" | "split" | "remote";

/** In every file of the WhatsApp versions: the form type, or the helpers. */
const WHATSAPP_CODE = /["']whatsapp["']|whatsappAuthMethod|requestWhatsAppOTP/;
export type Mode = "superforms" | "remote";

const AUTH = "src/routes/(public)/(auth)";

/** The files of each form, all swapped or none. */
export function pageGroups(mode: Mode): Record<"login" | "signup", string[]> {
  const group = (name: "login" | "signup") => [
    `${AUTH}/${name}/+page.svelte`,
    `${AUTH}/${name}/+page.server.ts`,
    ...(mode === "remote" ? [`${AUTH}/${name}/form.remote.ts`] : []),
    `src/lib/schemas/${name}.ts`,
  ];
  return { login: group("login"), signup: group("signup") };
}

/** A login form posts to a remote function in auth-remote projects. */
export function detectMode(root: string): Mode {
  return fs.existsSync(path.join(root, AUTH, "login", "form.remote.ts"))
    ? "remote"
    : "superforms";
}

const SHAPES: Record<Mode, Shape[]> = {
  superforms: ["base", "split"],
  remote: ["remote"],
};

/** The split variant only has its own pages; the rest is the base one. */
function pick(
  files: Record<string, string>,
  shape: Shape,
  rel: string,
): string | undefined {
  return (
    files[`${shape}/${rel}`] ??
    (shape === "split" ? files[`base/${rel}`] : undefined)
  );
}

function stock(shape: Shape, rel: string): string | undefined {
  return STOCK[shape][rel] ?? (shape === "split" ? STOCK.base[rel] : undefined);
}

/**
 * Every stock version of `rel` paired with its WhatsApp version: the current
 * and the legacy original of each shape on `enable`, and the WhatsApp version
 * paired with the current stock one on `disable`.
 */
export function candidatesFor(
  mode: Mode,
  rel: string,
  direction: "enable" | "disable",
): Candidate[] {
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  for (const shape of SHAPES[mode]) {
    const whatsapp = pick(TEMPLATES, shape, rel);
    const current = stock(shape, rel);
    if (!whatsapp || !current) continue;
    if (direction === "disable") {
      if (!seen.has(whatsapp))
        candidates.push({ original: whatsapp, template: current });
      seen.add(whatsapp);
      continue;
    }
    for (const original of [current, pick(LEGACY, shape, rel)]) {
      if (!original || seen.has(original)) continue;
      seen.add(original);
      candidates.push({ original, template: whatsapp });
    }
  }
  return candidates;
}

/**
 * enable-payments' signup hook, carried over the swap: its import and the
 * `linkStripeCustomer.run(...)` call (comment included) it adds before
 * `requestVerification`.
 */
const PAYMENTS_SIGNUP: Overlay = {
  detect: (content) => content.includes("linkStripeCustomer"),
  strip: (normalized) =>
    normalized
      .replace(
        /^import \{ linkStripeCustomer \} from "#lib\/workflows\/link-stripe-customer\.js";\n/m,
        "",
      )
      .replace(
        /^[ \t]*\/\/ Queued here, done in the background[^\n]*\n[ \t]*\/\/ and the key means[^\n]*\n[ \t]*await linkStripeCustomer\.run\([\s\S]*?\n[ \t]*\);\n\n?/m,
        "",
      ),
  apply: modifyUserSignup,
};

/**
 * Swaps the login and signup pages between the stock and WhatsApp versions.
 * A form whose files all still match a known version is swapped; one with
 * changes of its own is left alone and reported with `hint`.
 */
export async function swapAuthPages(
  root: string,
  direction: "enable" | "disable",
  hint: (filePath: string) => string,
): Promise<Map<string, ModifyOutcome>> {
  const mode = detectMode(root);
  // Code only the WhatsApp versions have (not a comment that mentions it):
  // enabling skips files with it, disabling files without it.
  const marker =
    direction === "enable"
      ? WHATSAPP_CODE
      : new RegExp(`^(?![\\s\\S]*(${WHATSAPP_CODE.source}))`);
  const outcomes = new Map<string, ModifyOutcome>();

  for (const files of Object.values(pageGroups(mode))) {
    const planned = await Promise.all(
      files.map((rel) =>
        planFile(
          path.join(root, rel),
          candidatesFor(mode, rel, direction),
          marker,
          rel.endsWith("signup/+page.server.ts") ? [PAYMENTS_SIGNUP] : [],
        ),
      ),
    );
    for (const [filePath, outcome] of applyGroup(planned, hint)) {
      outcomes.set(filePath, outcome);
    }
  }
  return outcomes;
}
