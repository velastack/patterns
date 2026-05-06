import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";

const POCKETBASE_BLOCK = `# PocketBase
/data/*
!/data/fixtures
!/data/seeds
!/data/hooks
`;

const NOT_FOUND_HINT = dedent`
  Create a .gitignore at the project root with the PocketBase block:

  # PocketBase
  /data/*
  !/data/fixtures
  !/data/seeds
  !/data/hooks
`;

export function modifyGitignore(gitignorePath: string): ModifyOutcome {
  if (!fs.existsSync(gitignorePath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const original = fs.readFileSync(gitignorePath, "utf8");

  if (original.includes("# PocketBase") && original.includes("/data/*")) {
    return { status: "success", changed: false };
  }

  const separator = original.endsWith("\n") ? "\n" : "\n\n";
  const next = original + separator + POCKETBASE_BLOCK;
  fs.writeFileSync(gitignorePath, next, "utf8");

  return { status: "success", changed: true };
}

export function unmodifyGitignore(gitignorePath: string): ModifyOutcome {
  if (!fs.existsSync(gitignorePath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(gitignorePath, "utf8");

  if (!original.includes("# PocketBase")) {
    return { status: "success", changed: false };
  }

  const withBlockRemoved = original.replace(
    /\n*# PocketBase\n\/data\/\*\n!\/data\/fixtures\n!\/data\/seeds\n!\/data\/hooks\n?/,
    "\n",
  );

  const cleaned = withBlockRemoved.replace(/\n{3,}$/, "\n");

  if (cleaned === original) {
    return { status: "success", changed: false };
  }

  fs.writeFileSync(gitignorePath, cleaned, "utf8");
  return { status: "success", changed: true };
}
