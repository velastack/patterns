import packageJson from "../package.json";
import generateForm from "./patterns/generate/form";
import generateResource from "./patterns/generate/resource";
import generateScaffold from "./patterns/generate/scaffold";
import generateSchema from "./patterns/generate/schema";
import enableAuth from "./patterns/enable/auth";

export const version = packageJson.version;

export const patterns = [
  generateForm,
  generateSchema,
  generateResource,
  generateScaffold,
  enableAuth,
];

type PatternEntry = (typeof patterns)[number];

export type Slug = PatternEntry["slug"];
export type Category = PatternEntry["category"];

export const bySlug = Object.fromEntries(
  patterns.map((pattern) => [pattern.slug, pattern]),
) as Record<Slug, PatternEntry>;

export const byCategory = patterns.reduce(
  (acc, pattern) => {
    const category = pattern.category;
    acc[category] ??= [];
    acc[category].push(pattern);
    return acc;
  },
  {} as Record<Category, PatternEntry[]>,
);
