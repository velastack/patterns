import fs from "node:fs";
import path from "node:path";
import type { File, Options, Result } from "../../../core/types";
import { modifyViteConfig } from "./modifies/vite-config";
import { modifySvelteConfig } from "./modifies/svelte-config";
import { modifyHooksServerI18n } from "./modifies/hooks.server";
import { modifyAppHtml } from "./modifies/app-html";
import { modifyGitignore } from "./modifies/gitignore";
import { ensureRootLayoutI18n } from "./modifies/+layout";

function findFirstExistingFile(
  root: string,
  candidates: string[],
): string | null {
  for (const relPath of candidates) {
    const absPath = path.join(root, relPath);
    if (fs.existsSync(absPath)) {
      return absPath;
    }
  }
  return null;
}

function pushIfChanged(modifies: File[], filePath: string, changed: boolean) {
  if (!changed || !fs.existsSync(filePath)) return;
  modifies.push({
    path: filePath,
    language: filePath.endsWith(".svelte")
      ? "svelte"
      : filePath.endsWith(".ts")
        ? "ts"
        : filePath.endsWith(".js")
          ? "js"
          : "text",
    content: fs.readFileSync(filePath, "utf8"),
  });
}

export async function generate(options: Options) {
  const modifies: File[] = [];

  const viteConfigPath = findFirstExistingFile(options.root, [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.cjs",
  ]);
  if (viteConfigPath) {
    pushIfChanged(modifies, viteConfigPath, modifyViteConfig(viteConfigPath));
  }

  const svelteConfigPath = findFirstExistingFile(options.root, [
    "svelte.config.ts",
    "svelte.config.js",
    "svelte.config.mjs",
    "svelte.config.cjs",
  ]);
  if (svelteConfigPath) {
    pushIfChanged(
      modifies,
      svelteConfigPath,
      modifySvelteConfig(svelteConfigPath),
    );
  }

  const hooksServerPath = path.join(options.root, "src", "hooks.server.ts");
  pushIfChanged(
    modifies,
    hooksServerPath,
    modifyHooksServerI18n(hooksServerPath),
  );

  const appHtmlPath = path.join(options.root, "src", "app.html");
  pushIfChanged(modifies, appHtmlPath, modifyAppHtml(appHtmlPath));

  const layoutPath = path.join(options.root, "src", "routes", "+layout.ts");
  pushIfChanged(modifies, layoutPath, ensureRootLayoutI18n(layoutPath));

  const gitignorePath = path.join(options.root, ".gitignore");
  pushIfChanged(modifies, gitignorePath, modifyGitignore(gitignorePath));

  return {
    creates: [],
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
  } satisfies Result;
}
