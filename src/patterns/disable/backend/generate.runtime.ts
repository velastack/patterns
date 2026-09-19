import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { languageFromPath } from "../../../core/util";
import {
  modifyOutcomeToFile,
  revertOutcomeToFile,
} from "../../../runtime/modify-file";
import { toDeleteEntry } from "../../destroy/shared";
import { unmodifyHooksServerBackend } from "./modifies/hooks.server";
import { unmodifyLayoutServerMeta } from "./modifies/layout-server";
import { unmodifySvelteConfig } from "../../enable/backend/modifies/svelte-config";
import { unmodifyGitignore } from "../../enable/backend/modifies/gitignore";
import { unmodifyTestSetup } from "../../enable/backend/modifies/test-setup";

/** `src/lib/site.ts` as the static template ships it, named after the package. */
function siteModule(root: string): string {
  let name = "My App";
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { name?: string };
    if (pkg.name) name = pkg.name;
  } catch {
    // No package.json to name the site after; the placeholder stands.
  }
  return [
    "/**",
    " * Site-wide metadata.",
    " *",
    " * Without a backend there is nothing to read this from at runtime, so this",
    " * file is the source of truth. Set `url` to where the site is deployed:",
    " * canonical links and Open Graph image URLs are built from it.",
    " */",
    "export const site = {",
    `\tname: ${JSON.stringify(name)},`,
    "\turl: 'http://localhost:5173'",
    "};",
    "",
  ].join("\n");
}

/** Every server test under a directory; they need the PocketBase test context. */
function serverTestFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...serverTestFiles(full));
    else if (entry.name === "server.test.ts") found.push(full);
  }
  return found;
}

export async function generate(options: Options) {
  const logger = getLogger(options);
  const creates: File[] = [];
  const modifies: File[] = [];
  const deletes: File[] = [];

  logger.info("Reverting adapter config");
  const revert = unmodifySvelteConfig(options.root);
  const svelteConfigFile = modifyOutcomeToFile(revert.filePath, revert.outcome);
  if (svelteConfigFile) modifies.push(svelteConfigFile);

  // Only the backend's handle and worker come out; handles other patterns
  // composed in stay. The file goes when nothing else was in it.
  logger.info("Reverting hooks.server.ts");
  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  const hooksServerRevert = revertOutcomeToFile(
    hooksServerPath,
    unmodifyHooksServerBackend(hooksServerPath),
  );
  if (hooksServerRevert.modify) modifies.push(hooksServerRevert.modify);
  if (hooksServerRevert.delete) deletes.push(hooksServerRevert.delete);

  logger.info("Reverting .gitignore");
  const gitignorePath = path.join(options.root, ".gitignore");
  const gitignoreFile = modifyOutcomeToFile(
    gitignorePath,
    unmodifyGitignore(gitignorePath),
  );
  if (gitignoreFile) modifies.push(gitignoreFile);

  logger.info("Reverting src/routes/+layout.server.ts");
  const layoutServerPath = path.join(
    options.root,
    "src",
    "routes",
    "+layout.server.ts",
  );
  const layoutServerFile = modifyOutcomeToFile(
    layoutServerPath,
    unmodifyLayoutServerMeta(layoutServerPath),
  );
  if (layoutServerFile) modifies.push(layoutServerFile);

  const sitePath = path.join(options.root, "src", "lib", "site.ts");
  if (layoutServerFile?.status === "success" && !fs.existsSync(sitePath)) {
    logger.info("Creating src/lib/site.ts");
    creates.push({
      path: sitePath,
      language: languageFromPath(sitePath),
      content: siteModule(options.root),
      status: "success",
    });
  }

  // Server tests run against the PocketBase-backed test context that the
  // backend's test/setup.ts provides; without it they neither type-check nor
  // run.
  for (const testFile of serverTestFiles(path.join(options.root, "src"))) {
    logger.info(`Removing ${path.relative(options.root, testFile)}`);
    deletes.push(toDeleteEntry(testFile));
  }

  logger.info("Reverting test/setup.ts");
  const testSetupPath = path.join(options.root, "test", "setup.ts");
  const testSetupFile = modifyOutcomeToFile(
    testSetupPath,
    unmodifyTestSetup(testSetupPath),
  );
  if (testSetupFile) modifies.push(testSetupFile);

  return {
    creates,
    modifies,
    deletes,
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
