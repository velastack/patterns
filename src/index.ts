import generateForm from "./patterns/generate/form";
import generateResource from "./patterns/generate/resource";
import generateScaffold from "./patterns/generate/scaffold";
import generateSchema from "./patterns/generate/schema";
import enableAuth from "./patterns/enable/auth";

const patterns = [
  generateForm,
  generateSchema,
  generateResource,
  generateScaffold,
  enableAuth,
];

type PatternEntry = (typeof patterns)[number];

export type Slug = PatternEntry["slug"];

type PatternsBySlug = {
  [Pattern in PatternEntry as Pattern["slug"]]: Pattern;
};

const bySlug = Object.fromEntries(
  patterns.map((pattern) => [pattern.slug, pattern]),
) as PatternsBySlug;

export default {
  version: "0.1.0",
  patterns,
  bySlug,
};
