import generateForm, { GENERATE_FORM_SLUG } from "./patterns/generate/form";
import generateResource, {
  GENERATE_RESOURCE_SLUG,
} from "./patterns/generate/resource";
import generateScaffold, {
  GENERATE_SCAFFOLD_SLUG,
} from "./patterns/generate/scaffold";
import generateSchema, {
  GENERATE_SCHEMA_SLUG,
} from "./patterns/generate/schema";
import enableAuth, { ENABLE_AUTH_SLUG } from "./patterns/enable/auth";
import type { Pattern } from "./core/types";

const patterns = [
  generateForm,
  generateSchema,
  generateResource,
  generateScaffold,
  enableAuth,
];

export type Slug =
  | typeof GENERATE_FORM_SLUG
  | typeof GENERATE_SCHEMA_SLUG
  | typeof GENERATE_RESOURCE_SLUG
  | typeof GENERATE_SCAFFOLD_SLUG
  | typeof ENABLE_AUTH_SLUG;

const bySlug = patterns.reduce(
  (acc, pattern) => {
    acc[pattern.slug as Slug] = pattern;
    return acc;
  },
  {} as Record<Slug, Pattern>,
);

export default {
  version: "0.1.0",
  patterns,
  bySlug,
};
