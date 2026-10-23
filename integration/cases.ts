import { bySlug, type Slug } from "../src/index";
import type { Features, Pattern } from "../src/core/types";

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
  /**
   * Substrings a project file must contain after the step, by path relative
   * to the project root. For what a pattern must leave in place that neither
   * svelte-check nor prettier would miss if it went (a composed hook, say).
   */
  expectContains?: Record<string, string[]>;
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
  ecommerce: "enable-ecommerce",
};

/** The order prerequisites are applied in; each entry's own `requires` precede it. */
export const PREREQ_ORDER: Slug[] = [
  "enable-workflows",
  "enable-auth",
  "enable-api",
  "enable-api-keys",
  "enable-payments",
  "enable-ecommerce",
  "enable-teams",
  "enable-i18n",
  "enable-blog",
  "enable-content-negotiation",
  "enable-cms",
];

/** A scaffold with one field of each type the list and detail pages render. */
const SCAFFOLD_FIELDS = [
  "pet",
  "name:text!",
  "kind:select(dog:Dog,cat:Cat)",
  "tags:select(small,large)",
  "done:bool",
  "born:date",
  "site:url",
  "notes:editor",
  "meta:json",
  "spot:geopoint",
  "photo:file",
  "photos:file",
  "owner:user",
];

/** The reroute enable-i18n and enable-content-negotiation compose, whichever runs first. */
const HOOKS = "src/hooks.ts";
const COMPOSED_REROUTE = "rerouteDeLocalize(negotiateReroute(url.pathname))";

/** wuchale's Spanish catalog, and the start of the WhatsApp order message as extracted. */
const CATALOG = "src/locales/es.po";
const ORDER_MESSAGE = "like to place an order";

/** Steps that call Stripe whatever their input says. */
const STRIPE_SLUGS = new Set<Slug>([
  "enable-subscriptions",
  "disable-subscriptions",
]);

/**
 * A step with the harness follow-ups a user would perform after the command.
 * A payments step is Stripe unless it says otherwise, so a chain that needs
 * payments gets the provider most patterns built on it support.
 */
export function step(slug: Slug, extra: Omit<StepSpec, "slug"> = {}): StepSpec {
  const spec: StepSpec = { slug, ...extra };
  if (slug === "enable-i18n") spec.after ??= "i18nExtract";
  if (slug === "enable-backend") spec.after ??= "bootstrapSuperuser";
  if (slug === "enable-payments") {
    spec.input = { provider: "stripe", ...spec.input };
  }
  return spec;
}

/**
 * A pattern's requirements with its provider's on top: `provider`, else the
 * first declared one, which is what `step` defaults a payments step to.
 */
function requiresOf(slug: Slug, provider?: unknown): Features {
  const pattern: Pattern = bySlug[slug];
  const chosen =
    pattern.providers?.find((candidate) => candidate.id === provider) ??
    pattern.providers?.[0];
  const requires: Features = { ...pattern.requires };
  for (const key of Object.keys(chosen?.requires ?? {}) as (keyof Features)[]) {
    if (key !== "ui" && chosen?.requires?.[key] === true) requires[key] = true;
  }
  return requires;
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
      visit(requiresOf(slug));
    }
  };
  visit(requires);
  if (baseline === "auth") needed.delete("enable-auth");
  return PREREQ_ORDER.filter((slug) => needed.has(slug)).map((slug) =>
    step(slug, { check: false }),
  );
}

function needsStripe(steps: StepSpec[]): "stripe" | undefined {
  return steps.some(
    (s) =>
      STRIPE_SLUGS.has(s.slug) ||
      (s.slug === "enable-payments" && s.input?.provider === "stripe"),
  )
    ? "stripe"
    : undefined;
}

function defaultBaseline(slug: Slug): BaselineName {
  if (slug === "enable-backend") return "static";
  const pattern = bySlug[slug];
  if (pattern.baseline === "velastack-auth" || pattern.requires.auth) {
    return "auth";
  }
  return "minimal";
}

/**
 * Every flag any of `list` requires. A disable case's setup steps bring their
 * own prerequisites: disable-subscriptions requires payments, but the
 * enable-subscriptions it undoes needs auth too.
 */
function combinedRequires(list: Features[]): Features {
  const combined: Features = { ...list[0] };
  for (const requires of list) {
    for (const key of Object.keys(requires) as (keyof Features)[]) {
      if (key !== "ui" && requires[key] === true) combined[key] = true;
    }
  }
  return combined;
}

/**
 * The baseline and prerequisite chain for `slug`. A chain that would enable
 * auth on `minimal` starts from the `auth` baseline instead, which is the
 * same project with auth already applied.
 */
function prerequisites(
  slug: Slug,
  requires: Features,
): { baseline: BaselineName; chain: StepSpec[] } {
  let baseline = defaultBaseline(slug);
  let chain = prereqChain(requires, baseline);
  if (baseline === "minimal" && chain.some((s) => s.slug === "enable-auth")) {
    baseline = "auth";
    chain = prereqChain(requires, baseline);
  }
  return { baseline, chain };
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
  const { baseline, chain } = prerequisites(
    slug,
    requiresOf(slug, overrides.input?.provider),
  );
  return makeCase(name, baseline, [
    ...chain,
    step(slug, { check: true, ...overrides }),
  ]);
}

/**
 * `disable-X` after `enable-X` (via `requires`), `destroy-X` after
 * `generate-X` with its example arguments.
 */
export function inverseCase(slug: Slug): CaseSpec {
  const setup: StepSpec[] = [];
  if (slug.startsWith("destroy-")) {
    const generator = `generate-${slug.slice("destroy-".length)}` as Slug;
    setup.push(step(generator, { check: false }));
  }
  if (slug === "disable-subscriptions") {
    setup.push(step("enable-subscriptions", { check: false }));
  }
  if (slug === "disable-whatsapp") {
    setup.push(step("enable-whatsapp", { check: false }));
  }
  if (slug === "disable-notifications") {
    setup.push(step("enable-notifications", { check: false }));
  }
  const { baseline, chain } = prerequisites(
    slug,
    combinedRequires([
      requiresOf(slug),
      ...setup.map((s) => requiresOf(s.slug, s.input?.provider)),
    ]),
  );
  return makeCase(slug, baseline, [
    ...chain,
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
  // The feed reads its name and URL from `#lib/site.js`, so the blog needs no
  // backend.
  makeCase("enable-blog-static", "static", [
    step("enable-blog", { check: true }),
  ]),
  singleCase("enable-cms"),
  singleCase("enable-content-negotiation"),
  // `sv create`: no route groups, no hooks.server.ts to compose into, and no
  // svelte-meta-tags, so the CLI passes `metaTags: false`.
  makeCase("enable-content-negotiation-plain", "bare", [
    step("enable-content-negotiation", {
      input: { metaTags: false },
      check: true,
    }),
  ]),
  // The on-ramp for a project vela did not create: adapter-node, hooks, and a
  // server test harness (test/setup.ts plus the vitest config that loads it).
  makeCase("enable-backend-plain", "bare", [
    step("enable-backend", { check: true }),
  ]),
  singleCase("enable-i18n"),
  // `sv create` has no shadcn-svelte and no navbar: the language select is a
  // native <select> above the root layout's children.
  makeCase("enable-i18n-plain", "bare", [step("enable-i18n", { check: true })]),
  singleCase("enable-notifications"),
  singleCase("enable-teams"),
  singleCase("enable-workflows"),
  singleCase("enable-payments"),
  // Shopify needs no backend, so it runs on the static template too.
  makeCase("enable-payments-shopify-static", "static", [
    step("enable-payments", { input: { provider: "shopify" }, check: true }),
  ]),
  singleCase(
    "enable-payments",
    { input: { provider: "shopify" } },
    "enable-payments-shopify",
  ),
  // WhatsApp needs no backend either.
  makeCase("enable-payments-whatsapp-static", "static", [
    step("enable-payments", { input: { provider: "whatsapp" }, check: true }),
  ]),
  singleCase(
    "enable-payments",
    { input: { provider: "whatsapp" } },
    "enable-payments-whatsapp",
  ),
  // The cart follows the payments provider, which the steps before it set.
  singleCase("enable-ecommerce", { input: { provider: "stripe" } }),
  makeCase("enable-ecommerce-auth", "auth", [
    step("enable-workflows", { check: false }),
    step("enable-payments", { check: false }),
    step("enable-ecommerce", { input: { provider: "stripe" }, check: true }),
  ]),
  makeCase("enable-ecommerce-shopify-static", "static", [
    step("enable-payments", { input: { provider: "shopify" }, check: false }),
    step("enable-ecommerce", { input: { provider: "shopify" }, check: true }),
  ]),
  makeCase("enable-ecommerce-shopify", "minimal", [
    step("enable-payments", { input: { provider: "shopify" }, check: false }),
    step("enable-ecommerce", { input: { provider: "shopify" }, check: true }),
  ]),
  makeCase("enable-ecommerce-whatsapp-static", "static", [
    step("enable-payments", { input: { provider: "whatsapp" }, check: false }),
    step("enable-ecommerce", { input: { provider: "whatsapp" }, check: true }),
  ]),
  makeCase("enable-ecommerce-whatsapp", "minimal", [
    step("enable-payments", { input: { provider: "whatsapp" }, check: false }),
    step("enable-ecommerce", { input: { provider: "whatsapp" }, check: true }),
  ]),
  singleCase("enable-subscriptions"),
  singleCase("enable-whatsapp"),
  // The login and signup pages it swaps come in three shapes.
  makeCase("enable-whatsapp-split", "minimal", [
    step("enable-auth", { input: { variant: "split" } }),
    step("enable-whatsapp", { check: true }),
  ]),
  makeCase("enable-whatsapp-remote", "minimal", [
    step("enable-auth-remote"),
    step("enable-whatsapp", { check: true }),
  ]),
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
  // Every cell type the list and detail pages render, and both facet
  // filters (single and multi select) of the TanStack table.
  singleCase(
    "generate-scaffold",
    { argv: SCAFFOLD_FIELDS },
    "generate-scaffold-fields",
  ),
  // `sv create` has no shadcn-svelte: a native table and native forms.
  makeCase("generate-scaffold-plain", "bare", [
    step("enable-backend"),
    step("generate-scaffold", { argv: SCAFFOLD_FIELDS, check: true }),
  ]),
  singleCase("generate-scaffold-remote"),
  singleCase("generate-schema"),
  // The shop, in each provider's terms: Stripe's on the backend (gated on
  // Stripe), Shopify's and WhatsApp's on a static site, and WhatsApp's CMS
  // pages on a static site that reads a hosted CMS.
  singleCase("generate-shop", { input: { provider: "stripe" } }),
  makeCase("generate-shop-shopify", "static", [
    step("enable-payments", { input: { provider: "shopify" } }),
    step("enable-ecommerce", { input: { provider: "shopify" } }),
    step("generate-shop", { input: { provider: "shopify" }, check: true }),
  ]),
  makeCase("generate-shop-whatsapp", "static", [
    step("enable-payments", { input: { provider: "whatsapp" } }),
    step("enable-ecommerce", { input: { provider: "whatsapp" } }),
    step("generate-shop", { input: { provider: "whatsapp" }, check: true }),
  ]),
  makeCase("generate-shop-whatsapp-cms", "static", [
    step("enable-cms", {
      input: { endpoint: "https://velastack.dev/v1/projects/demo/cms" },
    }),
    step("enable-payments", { input: { provider: "whatsapp" } }),
    step("enable-ecommerce", { input: { provider: "whatsapp" } }),
    step("generate-shop", { input: { provider: "whatsapp" }, check: true }),
  ]),
  // zod is not part of `sv create`; the schema has to bring it.
  makeCase("generate-schema-plain", "bare", [
    step("generate-schema", { check: true }),
  ]),
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
  inverseCase("destroy-shop"),
  inverseCase("disable-auth"),
  // Its code page goes with the auth pages.
  makeCase("disable-auth-whatsapp", "auth", [
    step("enable-whatsapp"),
    step("disable-auth", { check: true }),
  ]),
  inverseCase("disable-whatsapp"),
  inverseCase("disable-api"),
  inverseCase("disable-api-keys"),
  inverseCase("disable-backend"),
  inverseCase("disable-content-negotiation"),
  makeCase("disable-content-negotiation-plain", "bare", [
    step("enable-content-negotiation", { input: { metaTags: false } }),
    step("disable-content-negotiation", { check: true }),
  ]),
  inverseCase("disable-i18n"),
  makeCase("disable-i18n-plain", "bare", [
    step("enable-i18n", { check: false }),
    step("disable-i18n", { check: true }),
  ]),
  inverseCase("disable-notifications"),
  inverseCase("disable-teams"),
  inverseCase("disable-payments"),
  inverseCase("disable-ecommerce"),
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
  // An optional email reaches every page that shows or bills a user.
  makeCase("whatsapp-teams", "auth", [
    step("enable-teams"),
    step("enable-whatsapp", { check: true }),
  ]),
  makeCase("whatsapp-payments", "auth", [
    step("enable-teams"),
    step("enable-payments"),
    step("enable-whatsapp", { check: true }),
  ]),
  // Subscriptions and teams both add to the (app) layout load and nav-user;
  // neither may drop what the other put there, on the way in or out.
  makeCase("teams-then-subscriptions", "auth", [
    step("enable-teams"),
    step("enable-payments"),
    step("enable-subscriptions", {
      check: true,
      expectContains: {
        "src/routes/(app)/+layout.server.ts": ["teams", "subscription"],
        "src/lib/components/nav-user.svelte": ["/teams", "planLabel"],
      },
    }),
    step("disable-subscriptions", {
      check: true,
      expectContains: {
        "src/routes/(app)/+layout.server.ts": ["teams"],
        "src/lib/components/nav-user.svelte": ["/teams"],
      },
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
  // Either order leaves one reroute that does both: neither pattern writes
  // src/hooks.ts over what the other put there. svelte-check is blind to the
  // loss, hence the contents assertion.
  makeCase("i18n-then-negotiation", "minimal", [
    step("enable-i18n"),
    step("enable-content-negotiation", {
      check: true,
      expectContains: { [HOOKS]: [COMPOSED_REROUTE] },
    }),
  ]),
  makeCase("negotiation-then-i18n", "minimal", [
    step("enable-content-negotiation"),
    step("enable-i18n", {
      check: true,
      expectContains: { [HOOKS]: [COMPOSED_REROUTE] },
    }),
  ]),
  // The WhatsApp order message lives in src/lib/order.ts, which wuchale's js
  // adapter only extracts from when told: whichever is enabled first, the
  // catalog ends up with the message. On `minimal`: enable-i18n can't merge
  // into the static template's root layout load.
  makeCase("i18n-then-payments-whatsapp", "minimal", [
    step("enable-i18n"),
    step("enable-payments", {
      input: { provider: "whatsapp" },
      check: true,
      after: "i18nExtract",
      expectContains: {
        "wuchale.config.js": ["src/lib/order.ts"],
        [CATALOG]: [ORDER_MESSAGE],
      },
    }),
  ]),
  makeCase("payments-whatsapp-then-i18n", "minimal", [
    step("enable-payments", { input: { provider: "whatsapp" } }),
    step("enable-i18n", {
      check: true,
      expectContains: {
        "wuchale.config.js": ["src/lib/order.ts"],
        [CATALOG]: [ORDER_MESSAGE],
      },
    }),
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
    // With a server, the visitor's currency is decided per request.
    step("enable-payments", {
      expectContains: {
        "src/hooks.server.ts": ["handleCurrency"],
        "src/routes/+layout.server.ts": ["displayRates"],
        "src/routes/+layout.svelte": ["currency.hydrate"],
      },
    }),
    step("enable-subscriptions", { check: true }),
    step("disable-subscriptions"),
    step("disable-payments", { check: true }),
  ]),
  makeCase("ecommerce-shopify-lifecycle", "static", [
    step("enable-payments", { input: { provider: "shopify" } }),
    step("enable-ecommerce", { input: { provider: "shopify" } }),
    step("disable-ecommerce", { check: true }),
    step("enable-ecommerce", { input: { provider: "shopify" }, check: true }),
    step("disable-ecommerce"),
    step("disable-payments", { check: true }),
  ]),
  makeCase("payments-shopify-lifecycle", "static", [
    step("enable-payments", { input: { provider: "shopify" } }),
    step("disable-payments", { check: true }),
    step("enable-payments", { input: { provider: "shopify" }, check: true }),
  ]),
  makeCase("ecommerce-whatsapp-lifecycle", "static", [
    step("enable-payments", { input: { provider: "whatsapp" } }),
    step("enable-ecommerce", { input: { provider: "whatsapp" } }),
    step("disable-ecommerce", { check: true }),
    step("enable-ecommerce", { input: { provider: "whatsapp" }, check: true }),
    step("disable-ecommerce"),
    step("disable-payments", { check: true }),
  ]),
  // Disabling the cart takes the shop pages with it (they import the cart)
  // and leaves the developer's catalog module alone.
  makeCase("shop-then-disable-ecommerce", "static", [
    step("enable-payments", { input: { provider: "whatsapp" } }),
    step("enable-ecommerce", { input: { provider: "whatsapp" } }),
    step("generate-shop", { input: { provider: "whatsapp" } }),
    step("disable-ecommerce", {
      check: true,
      expectContains: { "src/lib/catalog.ts": ["export const catalog"] },
    }),
  ]),
  makeCase("payments-whatsapp-lifecycle", "static", [
    step("enable-payments", { input: { provider: "whatsapp" } }),
    step("disable-payments", { check: true }),
    step("enable-payments", { input: { provider: "whatsapp" }, check: true }),
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
