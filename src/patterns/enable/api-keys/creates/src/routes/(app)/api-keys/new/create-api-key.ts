import PocketBase from "pocketbase-svelte";
import argon2 from "argon2";
import { randomBytes } from "node:crypto";

export const createApiKey = async (
  pb: PocketBase,
  userId: string | undefined,
  label: string,
) => {
  const keySecret = randomBytes(10).toString("hex");
  const keyHash = await argon2.hash(keySecret, { type: argon2.argon2id });
  const apiKey = await pb
    .collection("api_keys")
    .create({ key_hash: keyHash, user: userId, label });

  return `${apiKey.id}.${keySecret}`;
};
