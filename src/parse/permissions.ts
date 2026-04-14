import type { Collection, OwnershipResult } from "./types";

interface AuthRuleOptions {
  authCollections?: string[];
  userFieldHints?: string[];
  maxDepth?: number;
  includeRootPrefix?: boolean;
  rootPrefix?: string;
}

type Edge = {
  from: string;
  fieldName: string;
  to: string;
  isMulti: boolean;
  hintScore: number;
};

const DEFAULT_USER_HINTS = [
  "user",
  "owner",
  "created_by",
  "author",
  "member",
  "account",
  "creator",
];

function lower(s: string): string {
  return s.toLowerCase();
}

function fallback(start: string): OwnershipResult {
  return {
    rule: '@request.auth.id != ""',
    ownershipChainCollections: [start],
    ownershipChainFields: [],
    operator: "=",
  };
}

export function generateAuthRule(
  schema: Collection[],
  startCollectionName: string,
  opts: AuthRuleOptions = {},
): OwnershipResult {
  const AUTH = new Set((opts.authCollections ?? ["users"]).map(lower));
  const USER_HINTS = new Set(
    (opts.userFieldHints ?? DEFAULT_USER_HINTS).map(lower),
  );
  const MAX_DEPTH = opts.maxDepth ?? 8;

  const byName = new Map<string, Collection>();
  const byId = new Map<string, Collection>();
  for (const c of schema) {
    byName.set(c.name, c);
    byId.set(c.id, c);
  }

  if (!byName.has(startCollectionName)) {
    return fallback(startCollectionName);
  }

  if (AUTH.has(lower(startCollectionName))) {
    return {
      rule: "@request.auth.id = id",
      ownershipChainCollections: [startCollectionName],
      ownershipChainFields: [],
      operator: "=",
    };
  }

  function hintScore(fieldName: string): number {
    const l = lower(fieldName);
    if (l === "user") return 50;
    if (USER_HINTS.has(l)) return 20;
    return 0;
  }

  function outEdges(collName: string): Edge[] {
    const c = byName.get(collName);
    if (!c?.fields) return [];
    const edges: Edge[] = [];
    for (const f of c.fields) {
      if (f.type !== "relation" || !f.collectionId) continue;
      const toColl = byId.get(f.collectionId);
      if (!toColl) continue;
      edges.push({
        from: collName,
        fieldName: f.name,
        to: toColl.name,
        isMulti: Boolean(f.maxSelect && f.maxSelect > 1),
        hintScore: hintScore(f.name),
      });
    }
    edges.sort((a, b) => a.fieldName.localeCompare(b.fieldName));
    return edges;
  }

  function isAuth(collName: string): boolean {
    return AUTH.has(lower(collName));
  }

  function validPath(path: Edge[]): boolean {
    if (path.length === 0) return false;
    for (let i = 0; i < path.length - 1; i++) {
      if (path[i].isMulti) return false;
    }
    return isAuth(path[path.length - 1].to);
  }

  function pathScore(path: Edge[]): number {
    const last = path[path.length - 1];
    const lastIsMulti = last.isMulti ? 1 : 0;
    const singlesAll = path.every((e) => !e.isMulti) ? 1 : 0;
    const hintSum = path.reduce((s, e) => s + e.hintScore, 0);
    const lastIsFieldNamedUser = lower(last.fieldName) === "user" ? 1 : 0;
    return (
      100 * path.length +
      50 * lastIsMulti -
      40 * lastIsFieldNamedUser -
      15 * singlesAll -
      hintSum
    );
  }

  function pathKey(path: Edge[]): string {
    return path.map((e) => `${e.from}.${e.fieldName}->${e.to}`).join("|");
  }

  const candidates: Edge[][] = [];
  const visited = new Set<string>([startCollectionName]);

  function dfs(curr: string, path: Edge[], depth: number) {
    if (depth > MAX_DEPTH) return;

    if (
      path.length > 0 &&
      isAuth(path[path.length - 1].to) &&
      validPath(path)
    ) {
      candidates.push([...path]);
      return;
    }

    for (const e of outEdges(curr)) {
      if (visited.has(e.to)) continue;
      if (e.isMulti && !isAuth(e.to)) continue;

      visited.add(e.to);
      path.push(e);
      dfs(e.to, path, depth + 1);
      path.pop();
      visited.delete(e.to);
    }
  }

  dfs(startCollectionName, [], 0);

  if (candidates.length === 0) {
    return fallback(startCollectionName);
  }

  candidates.sort((a, b) => {
    const diff = pathScore(a) - pathScore(b);
    if (diff !== 0) return diff;
    return pathKey(a).localeCompare(pathKey(b));
  });

  const best = candidates[0];
  const fields = best.map((e) => e.fieldName);
  const collections = [startCollectionName, ...best.map((e) => e.to)];
  const last = best[best.length - 1];
  const operator: "=" | "?=" = last.isMulti ? "?=" : "=";

  const fieldChain = fields.join(".");
  const prefix = opts.includeRootPrefix
    ? (opts.rootPrefix ?? startCollectionName) + "."
    : "";
  const rule = `@request.auth.id ${operator} ${prefix}${fieldChain}.id`;

  return {
    rule,
    ownershipChainCollections: collections,
    ownershipChainFields: fields,
    operator,
  };
}
