import { getCollections as getCollectionsFromPB } from "@velastack/pocketbase/internal";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { DATA_DIR } from "../core/constants";
import type { Collection } from "./types";

function hasProjectMarkers(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "package.json")) &&
    fs.existsSync(path.join(dir, DATA_DIR))
  );
}

export function resolveProjectRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    if (hasProjectMarkers(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(
    `Could not resolve project root from "${startDir}". Expected package.json, and ${DATA_DIR}.`,
  );
}

export async function getCollections(): Promise<Collection[]> {
  const root = resolveProjectRoot();

  return getCollectionsFromPB({
    pocketbaseUrl: "",
    superuserEmail: process.env.POCKETBASE_SUPERUSER_EMAIL!,
    superuserPassword: process.env.POCKETBASE_SUPERUSER_PASSWORD!,
    root,
  }) as Promise<Collection[]>;
}
