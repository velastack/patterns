/**
 * Keeps `src/core/versions.json` current: the one list of dependency ranges
 * every vela project starts from (see `src/core/versions.ts`).
 *
 *   npm run bump-versions                 raise what can be raised, write the file
 *   npm run bump-versions -- --check      report only; exits 1 when something is behind
 *   npm run bump-versions -- --cooldown 7 only releases at least 7 days old (default 3)
 *   npm run bump-versions -- --report f   also write the report as JSON to f
 *
 * What it raises on its own is what a caret already admits: the floor of each
 * range moves to the newest stable release inside it that has been out for
 * the cooldown. No template ships a lockfile, so a new project resolves those
 * releases whatever the floor says; raising it only stops an old lockfile or
 * cache from holding a project behind, and keeps the list honest.
 *
 * What it never does is leave a range: a new major, a new 0.x minor. Those
 * are listed under "outside the range" for someone (or an agent) to read the
 * changelog and verify, one package at a time. A package under `holds` is
 * listed with its reason instead, so a known block is not rediscovered every
 * week.
 *
 * A release whose `engines.node` starts above `node` (the oldest Node a
 * project may run on) is never a candidate: projects set `engine-strict`, so
 * it would fail the install there.
 *
 * A package under `tracks` takes its range from somewhere else. `sv-create`
 * is the minimal template `sv create` ships.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";

const FILE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/core/versions.json",
);
const REGISTRY = process.env.NPM_REGISTRY ?? "https://registry.npmjs.org";
const SV_CREATE_MANIFEST =
  "https://raw.githubusercontent.com/sveltejs/cli/main/packages/sv/src/create/templates/minimal/package.json";
const DAY = 24 * 60 * 60 * 1000;

interface VersionsFile {
  /** The oldest Node a project may run on: its `engines.node` floor. */
  node: string;
  packages: Record<string, string>;
  tracks: Record<string, { source: string; reason: string }>;
  holds: Record<string, { reason: string; since: string }>;
}

interface Packument {
  versions: Record<
    string,
    { deprecated?: string; engines?: { node?: string } }
  >;
  time: Record<string, string>;
}

interface Raised {
  name: string;
  from: string;
  to: string;
}
interface Outside {
  name: string;
  range: string;
  latest: string;
  published: string;
  hold?: string;
}
interface Report {
  cooldownDays: number;
  raised: Raised[];
  outside: Outside[];
  held: Outside[];
}

function parseArgs(argv: string[]) {
  const args = { check: false, cooldown: 3, report: null as string | null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--check") args.check = true;
    else if (arg === "--cooldown") args.cooldown = Number(argv[++i]);
    else if (arg === "--report") args.report = argv[++i] ?? null;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(args.cooldown) || args.cooldown < 0) {
    throw new Error("--cooldown takes a number of days");
  }
  return args;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${url}: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

/**
 * Stable, undeprecated releases that have been out for the cooldown and
 * install on the project's Node floor, oldest first. Projects set
 * `engine-strict`, so a release whose `engines.node` starts above the floor
 * fails the install there outright; it is not a candidate until the floor
 * moves.
 */
function settledVersions(
  doc: Packument,
  cutoff: number,
  node: string,
): string[] {
  return Object.keys(doc.versions)
    .filter((version) => {
      if (semver.prerelease(version)) return false;
      const manifest = doc.versions[version]!;
      if (manifest.deprecated) return false;
      const engines = manifest.engines?.node;
      if (
        engines &&
        semver.validRange(engines) &&
        !semver.satisfies(node, engines)
      ) {
        return false;
      }
      const published = doc.time[version];
      return published !== undefined && Date.parse(published) <= cutoff;
    })
    .sort(semver.compare);
}

/** `^1.2.3` with a new floor keeps its operator: `^1.4.0`; a bare version stays bare. */
function withFloor(range: string, version: string): string {
  const operator = /^[\^~]/.exec(range)?.[0] ?? "";
  return `${operator}${version}`;
}

async function trackedRange(name: string, source: string): Promise<string> {
  if (source !== "sv-create") {
    throw new Error(`${name}: unknown track source "${source}"`);
  }
  const manifest = await fetchJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(SV_CREATE_MANIFEST);
  const range = { ...manifest.dependencies, ...manifest.devDependencies }[name];
  if (!range || !semver.validRange(range)) {
    // Loud on purpose: sv has moved this file before, and a silent skip
    // would leave the range frozen with nobody the wiser.
    throw new Error(
      `${name}: sv create's minimal template (${SV_CREATE_MANIFEST}) lists no usable range for it`,
    );
  }
  return range;
}

async function bump(
  file: VersionsFile,
  cooldownDays: number,
  now = Date.now(),
): Promise<Report> {
  const report: Report = { cooldownDays, raised: [], outside: [], held: [] };
  const cutoff = now - cooldownDays * DAY;

  const names = Object.keys(file.packages);
  const docs = new Map<string, Packument>();
  // A few at a time: fifty full packuments at once gets some of them refused.
  for (let i = 0; i < names.length; i += 8) {
    await Promise.all(
      names.slice(i, i + 8).map(async (name) => {
        docs.set(
          name,
          await fetchJson<Packument>(`${REGISTRY}/${name.replace("/", "%2f")}`),
        );
      }),
    );
  }

  for (const name of names) {
    const range = file.packages[name]!;
    const all = settledVersions(docs.get(name)!, cutoff, "999.0.0");
    const settled = settledVersions(docs.get(name)!, cutoff, file.node);
    // Reported even when it needs a newer Node: that is worth knowing.
    const newest = all[all.length - 1];
    const floor = semver.minVersion(range)!;

    if (
      newest &&
      semver.gt(newest, floor) &&
      !semver.satisfies(newest, range)
    ) {
      const entry: Outside = {
        name,
        range,
        latest: newest,
        published: docs.get(name)!.time[newest]!.slice(0, 10),
      };
      const hold = file.holds[name];
      if (hold) report.held.push({ ...entry, hold: hold.reason });
      else report.outside.push(entry);
    }

    const track = file.tracks[name];
    if (track) {
      const tracked = await trackedRange(name, track.source);
      if (tracked !== range) {
        report.raised.push({ name, from: range, to: tracked });
        file.packages[name] = tracked;
      }
      continue;
    }

    const inRange = semver.maxSatisfying(settled, range);
    if (inRange && semver.gt(inRange, floor)) {
      const next = withFloor(range, inRange);
      report.raised.push({ name, from: range, to: next });
      file.packages[name] = next;
    }
  }

  for (const name of [
    ...Object.keys(file.holds),
    ...Object.keys(file.tracks),
  ]) {
    if (!(name in file.packages)) {
      throw new Error(`${name} is held or tracked but is not under "packages"`);
    }
  }
  return report;
}

function formatReport(report: Report): string {
  const lines: string[] = [];
  const table = (head: string[], rows: string[][]) => {
    lines.push(
      `| ${head.join(" | ")} |`,
      `|${head.map(() => "---").join("|")}|`,
    );
    for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
    lines.push("");
  };

  lines.push(`### Raised (${report.raised.length})`, "");
  if (report.raised.length === 0) lines.push("Nothing to raise.", "");
  else
    table(
      ["Package", "From", "To"],
      report.raised.map((r) => [
        `\`${r.name}\``,
        `\`${r.from}\``,
        `\`${r.to}\``,
      ]),
    );

  lines.push(`### Outside the range (${report.outside.length})`, "");
  if (report.outside.length === 0) lines.push("Nothing waiting.", "");
  else {
    lines.push(
      "Not raised here: each needs its changelog read and a verified, coordinated bump.",
      "",
    );
    table(
      ["Package", "Range", "Latest", "Published"],
      report.outside.map((o) => [
        `\`${o.name}\``,
        `\`${o.range}\``,
        o.latest,
        o.published,
      ]),
    );
  }

  if (report.held.length > 0) {
    lines.push(`### Held (${report.held.length})`, "");
    table(
      ["Package", "Range", "Latest", "Why"],
      report.held.map((h) => [
        `\`${h.name}\``,
        `\`${h.range}\``,
        h.latest,
        h.hold ?? "",
      ]),
    );
  }
  lines.push(
    `Only stable releases at least ${report.cooldownDays} days old are considered.`,
  );
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = JSON.parse(readFileSync(FILE, "utf8")) as VersionsFile;
  const report = await bump(file, args.cooldown);

  if (!args.check && report.raised.length > 0) {
    writeFileSync(FILE, `${JSON.stringify(file, null, 2)}\n`);
  }
  if (args.report) {
    writeFileSync(args.report, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(formatReport(report));
  if (args.check && report.raised.length + report.outside.length > 0) {
    process.exitCode = 1;
  }
}

await main();
