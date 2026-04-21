import packageJson from "../package.json";
export { InvalidArgumentError } from "./core/errors";
import generateForm from "./patterns/generate/form";
import generateFormRemote from "./patterns/generate/form-remote";
import generateMigration from "./patterns/generate/migration";
import generateResource from "./patterns/generate/resource";
import generateScaffold from "./patterns/generate/scaffold";
import generateScaffoldRemote from "./patterns/generate/scaffold-remote";
import generateSchema from "./patterns/generate/schema";
import enableAuth from "./patterns/enable/auth";
import enableAuthRemote from "./patterns/enable/auth-remote";
import enableApi from "./patterns/enable/api";
import enableApiKeys from "./patterns/enable/api-keys";
import enableContentNegotiation from "./patterns/enable/content-negotiation";
import enableI18n from "./patterns/enable/i18n";
import enablePayments from "./patterns/enable/payments";
import enableTeams from "./patterns/enable/teams";
import destroySchema from "./patterns/destroy/schema";
import destroyForm from "./patterns/destroy/form";
import destroyResource from "./patterns/destroy/resource";
import destroyScaffold from "./patterns/destroy/scaffold";
import disableApi from "./patterns/disable/api";
import disableApiKeys from "./patterns/disable/api-keys";
import disableAuth from "./patterns/disable/auth";
import disableAuthRemote from "./patterns/disable/auth-remote";
import disableI18n from "./patterns/disable/i18n";
import disableTeams from "./patterns/disable/teams";
import disablePayments from "./patterns/disable/payments";

export const version = packageJson.version;

export const patterns = [
  generateForm,
  generateFormRemote,
  generateMigration,
  generateSchema,
  generateResource,
  generateScaffold,
  generateScaffoldRemote,
  enableAuth,
  enableAuthRemote,
  enableApi,
  enableApiKeys,
  enableContentNegotiation,
  enableI18n,
  enablePayments,
  enableTeams,
  destroySchema,
  destroyForm,
  destroyResource,
  destroyScaffold,
  disableApi,
  disableApiKeys,
  disableAuth,
  disableAuthRemote,
  disableI18n,
  disableTeams,
  disablePayments,
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
