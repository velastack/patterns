import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { bySlug, patterns } from "../src/index";
import { unmetRequirements } from "../src/core/requires";
import { ensurePocketbaseEnv, makeGetCollections } from "../integration/apply";
import { INTEGRATION_ROOT, createVelaProject } from "../integration/baseline";
import { detectFeatures, detectProviders } from "../integration/features";

function usage(): never {
  console.error(
    "Usage: npm run demo -- <category> <name> [argv...] [, <category> <name> [argv...]]...",
  );
  console.error("");
  console.error("Examples:");
  console.error("  npm run demo -- enable auth");
  console.error("  npm run demo -- enable auth, enable teams");
  console.error(
    "  npm run demo -- enable auth, enable api-keys, generate form contact name:text",
  );
  console.error(
    "  npm run demo -- generate scaffold posts title:text body:editor",
  );
  console.error("");
  console.error("Available patterns:");
  for (const p of patterns) {
    console.error(`  ${p.slug}`);
  }
  process.exit(1);
}

/**
 * Splits the raw CLI args into one command per comma. Tolerant of whitespace
 * around the comma (`enable auth, enable teams` and `enable auth , enable teams`
 * both work).
 */
function splitCommands(args: string[]): string[][] {
  return args
    .join(" ")
    .split(",")
    .map((cmd) => cmd.trim().split(/\s+/).filter(Boolean))
    .filter((cmd) => cmd.length > 0);
}

interface ParsedCommand {
  slug: string;
  argv: string[];
  pattern: (typeof patterns)[number];
}

function parseCommand(tokens: string[]): ParsedCommand {
  if (tokens.length < 2) {
    console.error(
      `Invalid command: "${tokens.join(" ")}" — expected <category> <name> [argv...]`,
    );
    usage();
  }
  const [category, name, ...argv] = tokens;
  const slug = `${category}-${name}`;
  const pattern = bySlug[slug as keyof typeof bySlug];
  if (!pattern) {
    console.error(`Pattern not found: ${slug}`);
    usage();
  }
  return { slug, argv, pattern };
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

const commands = splitCommands(args).map(parseCommand);
if (commands.length === 0) usage();

const dirSuffix = commands
  .map((c) => c.slug.replace(/^(enable|generate)-/, ""))
  .join("+");

mkdirSync(INTEGRATION_ROOT, { recursive: true });
const tempRoot = mkdtempSync(path.join(INTEGRATION_ROOT, `demo-${dirSuffix}-`));

console.log(`\nProject directory: ${tempRoot}`);
console.log(`Patterns: ${commands.map((c) => c.slug).join(" → ")}\n`);

// Same scaffold as the integration harness: `vela create`, then dependencies
// from the hash-keyed node_modules cache when an identical set was installed
// before (see integration/baseline.ts).
console.log("Running vela create...\n");
try {
  createVelaProject(tempRoot, "minimal");
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  console.error("\nvela create failed, cleaning up...");
  rmSync(tempRoot, { recursive: true, force: true });
  process.exit(1);
}

ensurePocketbaseEnv();
const getCollections = makeGetCollections(tempRoot);

const prev = process.cwd();
process.chdir(tempRoot);

for (const [index, { slug, argv, pattern }] of commands.entries()) {
  // Detect features the way the CLI does. Missing prerequisites are reported
  // rather than switched on: pretending a feature is there hides what the CLI
  // would refuse. Chain the enable-* commands they name to satisfy them.
  const features = detectFeatures(tempRoot);
  const detected = detectProviders(tempRoot);
  const unmet = unmetRequirements(pattern, { features, detected });
  if (unmet.length > 0) {
    console.warn(
      `  ! ${slug} is missing prerequisites the CLI would refuse it for: ${JSON.stringify(unmet)}`,
    );
  }

  console.log(
    `\n[${index + 1}/${commands.length}] Applying ${slug}${argv.length ? ` ${argv.join(" ")}` : ""}\n`,
  );

  const result = await pattern.generate({
    argv,
    env: "runtime",
    root: tempRoot,
    features,
    providers: detected.providers,
    input: {},
    getCollections,
    logger: { info: (message) => console.log(`  ${message}`) },
  });

  for (const f of result.creates) console.log(`  + ${f.path}`);
  for (const f of result.modifies) console.log(`  ~ ${f.path}`);
  for (const f of result.deletes) console.log(`  - ${f.path}`);
  for (const c of result.components) console.log(`  * component: ${c}`);
  for (const p of result.packages) console.log(`  * package: ${p}`);
}

process.chdir(prev);

console.log(`\nDone. Project: ${tempRoot}`);
