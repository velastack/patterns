import type {
  DetectedProviders,
  FeatureFlag,
  Features,
  Pattern,
  Provider,
  Requires,
} from "./types";

/**
 * The features in `pattern.blockedBy` that the project has on, in the
 * pattern's order. Empty means nothing stands in the way. A disable pattern
 * names the features whose code imports what it removes, so that
 * `disable-payments` refuses while the cart still imports the Stripe client.
 */
export function blockingFeatures(
  pattern: Pick<Pattern, "blockedBy">,
  features: Features,
): FeatureFlag[] {
  return (pattern.blockedBy ?? []).filter((flag) => features[flag] === true);
}

/** One prerequisite a project is missing for a pattern. */
export type Unmet =
  | { kind: "feature"; feature: keyof Features }
  | {
      kind: "provider";
      capability: string;
      /** Provider ids that would satisfy the pattern. */
      want: string[];
      /** What the project has, `null` for none. */
      have: string | null;
    }
  | { kind: "ambiguous"; capability: string; ids: string[] };

type RequiresPattern = Pick<
  Pattern,
  "requires" | "providers" | "inheritsProvider"
>;

export interface RequirementsContext {
  features: Features;
  detected: DetectedProviders;
  /** The provider chosen for this run, when the caller already knows it. */
  provider?: string;
}

/**
 * What `pattern` needs that the project doesn't have, in a stable order:
 * missing features, then providers, then ambiguous detections. Empty means
 * the pattern can run.
 *
 * Only `true` flags are requirements. `false` means "not required", never
 * "must be absent", and `ui` is left to its own check, since it is a value
 * rather than a flag. The chosen provider's own `requires` is added to the
 * pattern's; for a pattern with `inheritsProvider`, the chosen provider is the
 * detected one.
 */
export function unmetRequirements(
  pattern: RequiresPattern,
  context: RequirementsContext,
): Unmet[] {
  const { features, detected } = context;
  const providerId =
    context.provider ??
    (pattern.inheritsProvider
      ? detected.providers[pattern.inheritsProvider]
      : undefined);
  const provider = pattern.providers?.find(
    (candidate) => candidate.id === providerId,
  );
  const requires = mergeRequires(pattern.requires, provider);

  const unmet: Unmet[] = [];
  const missingFeatures = new Set<string>();

  for (const [key, value] of Object.entries(requires)) {
    if (key === "ui" || key === "providers" || value !== true) continue;
    if (!features[key as keyof Features]) {
      missingFeatures.add(key);
      unmet.push({ kind: "feature", feature: key as keyof Features });
    }
  }

  const wanted: [string, string[]][] = Object.entries(
    requires.providers ?? {},
  ).filter((entry): entry is [string, string[]] => entry[1] !== undefined);
  if (pattern.inheritsProvider && pattern.providers) {
    wanted.push([
      pattern.inheritsProvider,
      pattern.providers.map((candidate) => candidate.id),
    ]);
  }

  const reported = new Set<string>();
  for (const [capability, want] of wanted) {
    if (reported.has(capability)) continue;
    const have = detected.providers[capability] ?? null;
    if (have !== null && want.includes(have)) continue;
    // A capability that is also a missing feature is already reported.
    if (have === null && missingFeatures.has(capability)) continue;
    if (detected.ambiguous.some((entry) => entry.capability === capability)) {
      continue;
    }
    reported.add(capability);
    unmet.push({ kind: "provider", capability, want, have });
  }

  const referenced = new Set(wanted.map(([capability]) => capability));
  for (const entry of detected.ambiguous) {
    if (referenced.has(entry.capability)) {
      unmet.push({
        kind: "ambiguous",
        capability: entry.capability,
        ids: entry.ids,
      });
    }
  }

  return unmet;
}

/**
 * The pattern's requirements with the provider's on top. A flag is required
 * when either says so; a provider's list for a capability replaces the
 * pattern's.
 */
function mergeRequires(requires: Requires, provider?: Provider): Requires {
  const extra = provider?.requires;
  if (!extra) return requires;

  const merged: Requires = { ...requires };
  for (const key of Object.keys(extra) as (keyof Requires)[]) {
    if (key === "providers" || key === "ui") continue;
    if (extra[key] === true) merged[key] = true;
  }
  if (extra.ui) merged.ui = extra.ui;
  if (extra.providers) {
    merged.providers = { ...requires.providers, ...extra.providers };
  }
  return merged;
}
