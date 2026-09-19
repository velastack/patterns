import { bySlug, type Slug } from "../src/index";
import type { Features } from "../src/core/types";

/**
 * Starting points for a case:
 * - `minimal`: `vela create --template minimal` (PocketBase backend, no auth);
 * - `static`: `vela create --template static` (no backend at all);
 * - `bare`: `sv create`, a project vela did not create (no shadcn-svelte);
 * - `auth`: `minimal` with `enable-auth` applied.
 */
export type BaselineName = "minimal" | "static" | "auth" | "bare";

export interface StepSpec {
  slug: Slug;
  /** Defaults to the pattern's `command.argv` example. */
  argv?: string[];
  input?: Record<string, unknown>;
  /** Run svelte-check / prettier after this step. Defaults to "last step only". */
  check?: boolean;
  /** Feature flags that must be detected after the step. Defaults to `expectedFeaturesAfter(slug)`. */
  expectFeatures?: Partial<Features>;
  /** Harness action mirroring what a user does right after the command. */
  after?: "bootstrapSuperuser" | "i18nExtract";
}

export interface CaseSpec {
  name: string;
  baseline: BaselineName;
  steps: StepSpec[];
  /** External services the case depends on; the runner skips when they are not configured. */
  requires?: "stripe";
}

const FEATURE_ENABLER: Partial<Record<keyof Features, Slug>> = {
  auth: "enable-auth",
  api: "enable-api",
  apiKeys: "enable-api-keys",
  payments: "enable-payments",
  teams: "enable-teams",
  i18n: "enable-i18n",
  blog: "enable-blog",
  contentNegotiation: "enable-content-negotiation",
  cms: "enable-cms",
  workflows: "enable-workflows",
};

/** The order prerequisites are applied in; each entry's own `requires` precede it. */
export const PREREQ_ORDER: Slug[] = [
  "enable-workflows",
  "enable-auth",
  "enable-api",
  "enable-api-keys",
  "enable-payments",
  "enable-teams",
  "enable-i18n",
  "enable-blog",
  "enable-content-negotiation",
  "enable-cms",
];

const STRIPE_SLUGS = new Set<Slug>([
  "enable-payments",
  "enable-subscriptions",
  "disable-payments",
  "disable-subscriptions",
]);

/** A step with the harness follow-ups a user would perform after the command. */
export function step(slug: Slug, extra: Omit<StepSpec, "slug"> = {}): StepSpec {
  const spec: StepSpec = { slug, ...extra };
  if (slug === "enable-i18n") spec.after ??= "i18nExtract";
  if (slug === "enable-backend") spec.after ??= "bootstrapSuperuser";
  return spec;
}

/**
 * The enable-* steps a pattern's `requires` implies, transitively, in
 * `PREREQ_ORDER`. `backend` is satisfied by the `minimal` template and `auth`
 * by the `auth` baseline; both are left out of the chain.
 */
export function prereqChain(
  requires: Features,
  baseline: BaselineName,
): StepSpec[] {
  const needed = new Set<Slug>();
  const visit = (req: Features) => {
    for (const [feature, on] of Object.entries(req)) {
      if (!on) continue;
      const slug = FEATURE_ENABLER[feature as keyof Features];
      if (!slug || needed.has(slug)) continue;
      needed.add(slug);
      visit(bySlug[slug].requires);
    }
  };
  visit(requires);
  if (baseline === "auth") needed.delete("enable-auth");
  return PREREQ_ORDER.filter((slug) => needed.has(slug)).map((slug) =>
    step(slug, { check: false }),
  );
}

function needsStripe(steps: StepSpec[]): "stripe" | undefined {
  return steps.some((s) => STRIPE_SLUGS.has(s.slug)) ? "stripe" : undefined;
}

function defaultBaseline(slug: Slug): BaselineName {
  if (slug === "enable-backend") return "static";
  const pattern = bySlug[slug];
  if (pattern.baseline === "velastack-auth" || pattern.requires.auth) {
    return "auth";
  }
  return "minimal";
}

export function makeCase(
  name: string,
  baseline: BaselineName,
  steps: StepSpec[],
): CaseSpec {
  return { name, baseline, steps, requires: needsStripe(steps) };
}

/** Prerequisites (unchecked) followed by the pattern itself (checked). */
export function singleCase(
  slug: Slug,
  overrides: Omit<StepSpec, "slug"> = {},
  name: string = slug,
): CaseSpec {
  const baseline = defaultBaseline(slug);
  const pattern = bySlug[slug];
  return makeCase(name, baseline, [
    ...prereqChain(pattern.requires, baseline),
    step(slug, { check: true, ...overrides }),
  ]);
}

/**
 * `disable-X` after `enable-X` (via `requires`), `destroy-X` after
 * `generate-X` with its example arguments.
 */
export function inverseCase(slug: Slug): CaseSpec {
  const baseline = defaultBaseline(slug);
  const pattern = bySlug[slug];
  const setup: StepSpec[] = [];
  if (slug.startsWith("destroy-")) {
    const generator = `generate-${slug.slice("destroy-".length)}` as Slug;
    setup.push(step(generator, { check: false }));
  }
  if (slug === "disable-subscriptions") {
    setup.push(step("enable-subscriptions", { check: false }));
  }
  return makeCase(slug, baseline, [
    ...prereqChain(pattern.requires, baseline),
    ...setup,
    step(slug, { check: true }),
  ]);
}

export const enableCases: CaseSpec[] = [
  singleCase(
    "enable-ai",
    { input: { provider: "gateway" } },
    "enable-ai-gateway",
  ),
  singleCase(
    "enable-ai",
    { input: { provider: "openai" } },
    "enable-ai-openai",
  ),
  singleCase(
    "enable-ai",
    { input: { provider: "anthropic" } },
    "enable-ai-anthropic",
  ),
  // `sv create`: no shadcn-svelte, no route groups and no test harness, so a
  // native chat page lands at src/routes/ai and no server.test.ts is written.
  makeCase("enable-ai-plain", "bare", [
    step("enable-ai", {
      input: { provider: "gateway", serverTests: false },
      check: true,
    }),
  ]),
  singleCase(
    "enable-analytics",
    { input: { provider: "plausible" } },
    "enable-analytics-plausible",
  ),
  singleCase(
    "enable-analytics",
    { input: { provider: "google" } },
    "enable-analytics-google",
  ),
  singleCase(
    "enable-analytics",
    { input: { provider: "posthog" } },
    "enable-analytics-posthog",
  ),
  singleCase("enable-auth"),
  singleCase(
    "enable-auth",
    { input: { variant: "split" } },
    "enable-auth-split",
  ),
  singleCase("enable-auth-remote"),
  singleCase("enable-api", { expectFeatures: { api: true } }),
  singleCase("enable-api-keys"),
  singleCase("enable-backend"),
  singleCase("enable-blog"),
  // The feed reads its name and URL from `$lib/site`, so the blog needs no
  // backend.
  makeCase("enable-blog-static", "static", [
    step("enable-blog", { check: true }),
  ]),
  singleCase("enable-cms"),
  singleCase("enable-content-negotiation"),
  singleCase("enable-i18n"),
  // `sv create` has no shadcn-svelte and no navbar: the language select is a
  // native <select> above the root layout's children.
  makeCase("enable-i18n-plain", "bare", [step("enable-i18n", { check: true })]),
  singleCase("enable-notifications"),
  singleCase("enable-teams"),
  singleCase("enable-workflows"),
  singleCase("enable-payments"),
  singleCase("enable-subscriptions"),
];

export const generateCases: CaseSpec[] = [
  singleCase("generate-form"),
  singleCase("generate-form-remote"),
  // Outside a vela project the CLI detects no flash messages or test harness
  // and passes exactly this input; `ui: "plain"` and the missing `(public)`
  // group come from the detected features and route groups.
  ...(["generate-form", "generate-form-remote"] as const).map((slug) =>
    makeCase(`${slug}-plain`, "bare", [
      step(slug, {
        check: true,
        input: { flash: false, serverTests: false },
      }),
    ]),
  ),
  singleCase("generate-migration"),
  singleCase("generate-resource"),
  singleCase("generate-scaffold"),
  singleCase("generate-scaffold-remote"),
  singleCase("generate-schema"),
  singleCase("generate-workflow"),
];

export const disableCases: CaseSpec[] = [
  // disable-ai and disable-analytics `require` nothing, so inverseCase would
  // not enable them first.
  makeCase("disable-ai", "minimal", [
    step("enable-ai", { input: { provider: "openai" } }),
    step("disable-ai", { check: true }),
  ]),
  // The demo page and the signed-in endpoint live under (app).
  makeCase("disable-ai-auth", "auth", [
    step("enable-ai", { input: { provider: "anthropic" } }),
    step("disable-ai", { check: true }),
  ]),
  makeCase("disable-ai-plain", "bare", [
    step("enable-ai", { input: { provider: "gateway", serverTests: false } }),
    step("disable-ai", { check: true }),
  ]),
  makeCase("disable-analytics", "minimal", [
    step("enable-analytics", { input: { provider: "posthog" } }),
    step("disable-analytics", { check: true }),
  ]),
  makeCase("disable-analytics-static", "static", [
    step("enable-analytics", { input: { provider: "google" } }),
    step("disable-analytics", { check: true }),
  ]),
  inverseCase("destroy-form"),
  inverseCase("destroy-schema"),
  inverseCase("destroy-resource"),
  inverseCase("destroy-scaffold"),
  inverseCase("disable-auth"),
  inverseCase("disable-api"),
  inverseCase("disable-api-keys"),
  inverseCase("disable-backend"),
  inverseCase("disable-content-negotiation"),
  inverseCase("disable-i18n"),
  makeCase("disable-i18n-plain", "bare", [
    step("enable-i18n", { check: false }),
    step("disable-i18n", { check: true }),
  ]),
  inverseCase("disable-notifications"),
  inverseCase("disable-teams"),
  inverseCase("disable-payments"),
  inverseCase("disable-subscriptions"),
];

const TEAM_ROUTE = "(app)/[team_id]/projects";

/** Combinations where one pattern's output depends on another being detected. */
export const stackCases: CaseSpec[] = [
  // One model per generator: the examples all use `contact`, and
  // generate-resource refuses a collection an earlier step created.
  makeCase("auth-generators", "auth", [
    step("generate-scaffold", {
      argv: ["product", "name:text", "price:number"],
      check: true,
    }),
    step("generate-form", {
      argv: ["feedback", "name:text", "email:email"],
      check: true,
    }),
    step("generate-resource", {
      argv: ["invoice", "amount:number", "paid:bool"],
      check: true,
    }),
    step("generate-schema", {
      argv: ["author", "bio:text", "website:url"],
      check: true,
    }),
  ]),
  // Relation fields render from `data.<plural>`, which only type-checks when
  // the form's `load` fetches the related collections.
  makeCase("form-relations", "minimal", [
    step("generate-scaffold", { argv: ["writer", "name:text"] }),
    step("generate-scaffold", { argv: ["label", "title:text"] }),
    step("generate-scaffold", {
      argv: ["article", "title:text", "writer:writer", "labels:labels"],
    }),
    step("generate-form", {
      argv: ["article"],
      input: { route: "(public)/write" },
      check: true,
    }),
    step("generate-form", {
      argv: ["article"],
      input: { route: "(public)/write-plain", ui: "plain" },
      check: true,
    }),
    step("generate-form", {
      argv: ["review", "body:text", "writer:writer", "labels:labels"],
      check: true,
    }),
  ]),
  makeCase("teams-scaffold-roundtrip", "auth", [
    step("enable-teams"),
    step("generate-scaffold", {
      argv: ["project", "name:text", "owner:current_team"],
      input: { route: TEAM_ROUTE },
      check: true,
    }),
    step("destroy-scaffold", {
      argv: ["project"],
      input: { route: TEAM_ROUTE },
      check: true,
    }),
  ]),
  makeCase("nav-user-stacking", "auth", [
    step("enable-api"),
    step("enable-api-keys"),
    step("enable-teams"),
    step("enable-notifications", { check: true }),
  ]),
  makeCase("blog-then-negotiation", "minimal", [
    step("enable-blog"),
    step("enable-content-negotiation", { check: true }),
  ]),
  makeCase("negotiation-then-blog", "minimal", [
    step("enable-content-negotiation"),
    step("enable-blog", { check: true }),
  ]),
  makeCase("i18n-then-negotiation", "minimal", [
    step("enable-i18n"),
    step("enable-content-negotiation", { check: true }),
  ]),
  makeCase("negotiation-then-i18n", "minimal", [
    step("enable-content-negotiation"),
    step("enable-i18n", { check: true }),
  ]),
  // With i18n on, the CMS takes its locales from wuchale instead of a literal.
  makeCase("i18n-then-cms", "minimal", [
    step("enable-i18n"),
    step("enable-cms", { check: true }),
  ]),
  // A static site has no server for the backend; it reads from a hosted CMS.
  makeCase("static-cms", "static", [
    step("enable-cms", {
      input: { endpoint: "https://velastack.dev/v1/projects/demo/cms" },
      check: true,
    }),
  ]),
  // A static site reads PUBLIC_* env at build time; the component must
  // prerender with the keys blank.
  makeCase("static-analytics", "static", [
    step("enable-analytics", { input: { provider: "plausible" }, check: true }),
  ]),
  makeCase("auth-then-i18n", "auth", [step("enable-i18n", { check: true })]),
  // With auth the demo page moves into (app) and /api/chat answers 401 to
  // anonymous requests; the server tests cover both.
  makeCase("auth-then-ai", "auth", [
    step("enable-ai", { input: { provider: "anthropic" }, check: true }),
  ]),
  makeCase("i18n-then-auth", "minimal", [
    step("enable-i18n"),
    step("enable-auth", { check: true }),
  ]),
  makeCase("remote-functions", "minimal", [
    step("enable-auth-remote"),
    // Not the `contact` example: the form step would regenerate its schema
    // without the id the scaffold's edit form reads.
    step("generate-scaffold-remote", {
      argv: ["product", "name:text", "price:number"],
    }),
    step("generate-form-remote", { check: true }),
  ]),
  makeCase("static-backend-auth", "static", [
    step("enable-backend", { check: true }),
    step("enable-auth", { check: true }),
  ]),
  // The backend composes its handle into the hooks.server.ts i18n already
  // wrote instead of overwriting the file, and disabling it takes only that
  // handle back out. On `bare` because enable-i18n cannot merge into the
  // static template's +layout.ts load.
  makeCase("i18n-then-backend", "bare", [
    step("enable-i18n"),
    step("enable-backend", { check: true }),
  ]),
  makeCase("i18n-backend-roundtrip", "bare", [
    step("enable-i18n"),
    step("enable-backend"),
    step("disable-backend", {
      check: true,
      expectFeatures: { backend: false, i18n: true },
    }),
  ]),
  makeCase("payments-lifecycle", "auth", [
    step("enable-payments"),
    step("enable-subscriptions", { check: true }),
    step("disable-subscriptions"),
    step("disable-payments", { check: true }),
  ]),
];

/** Everything on, everything generated, everything torn down again. */
export const lifecycleCases: CaseSpec[] = [
  makeCase("kitchen-sink", "minimal", [
    step("enable-auth"),
    step("enable-api"),
    step("enable-api-keys"),
    step("enable-teams"),
    step("enable-notifications"),
    step("enable-i18n"),
    step("enable-blog"),
    step("enable-content-negotiation", { check: true }),
    step("generate-scaffold", {
      argv: ["product", "name:text", "price:number"],
    }),
    step("generate-form", { argv: ["feedback", "name:text", "email:email"] }),
    step("generate-resource", {
      argv: ["invoice", "amount:number", "paid:bool"],
    }),
    // Not `profile`: enable-auth owns src/lib/schemas/profile.ts and its
    // settings page imports it, so a generated one would replace it.
    step("generate-schema", { argv: ["author", "bio:text", "website:url"] }),
    step("generate-migration", {
      argv: ["users", "add", "birthday:date"],
      check: true,
    }),
    step("destroy-schema", { argv: ["author"] }),
    step("destroy-resource", { argv: ["invoices"] }),
    step("destroy-form", { argv: ["feedback"] }),
    step("destroy-scaffold", { argv: ["products"] }),
    step("disable-content-negotiation"),
    step("disable-i18n"),
    step("disable-notifications"),
    step("disable-teams"),
    step("disable-api-keys"),
    step("disable-api"),
    step("disable-auth", { check: true }),
  ]),
];

export const suites = {
  enable: enableCases,
  generate: generateCases,
  disable: disableCases,
  stacks: stackCases,
  lifecycle: lifecycleCases,
} as const;

export function allCases(): { suite: string; spec: CaseSpec }[] {
  return Object.entries(suites).flatMap(([suite, cases]) =>
    cases.map((spec) => ({ suite, spec })),
  );
}
