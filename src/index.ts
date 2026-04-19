import packageJson from "../package.json";
export { InvalidArgumentError } from "./core/errors";
import generateForm from "./patterns/generate/form";
import generateFormRemote from "./patterns/generate/form-remote";
import generateResource from "./patterns/generate/resource";
import generateScaffold from "./patterns/generate/scaffold";
import generateScaffoldRemote from "./patterns/generate/scaffold-remote";
import generateSchema from "./patterns/generate/schema";
import enableAuth from "./patterns/enable/auth";
import enableAuthRemote from "./patterns/enable/auth-remote";
import enableApi from "./patterns/enable/api";
import enableApiKeys from "./patterns/enable/api-keys";
import enableI18n from "./patterns/enable/i18n";
import enablePayments from "./patterns/enable/payments";
import enableTeams from "./patterns/enable/teams";

export const version = packageJson.version;

export const patterns = [
  generateForm,
  generateFormRemote,
  generateSchema,
  generateResource,
  generateScaffold,
  generateScaffoldRemote,
  enableAuth,
  enableAuthRemote,
  enableApi,
  enableApiKeys,
  enableI18n,
  enablePayments,
  enableTeams,
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
