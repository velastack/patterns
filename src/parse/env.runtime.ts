import { getCollections as getCollectionsFromPB } from "@velastack/pocketbase/internal";
import process from "node:process";
import type { Collection } from "./types";

export async function getCollections(): Promise<Collection[]> {
  return getCollectionsFromPB({
    pocketbaseUrl: "",
    superuserEmail: process.env.POCKETBASE_SUPERUSER_EMAIL!,
    superuserPassword: process.env.POCKETBASE_SUPERUSER_PASSWORD!,
  }) as Promise<Collection[]>;
}
