import PocketBase from "pocketbase-sveltekit";
import { generateApiKeySecret, hashApiKey } from "@velastack/pocketbase/api-key";

export const createApiKey = async (
  pb: PocketBase,
  userId: string | undefined,
  label: string,
) => {
  const keySecret = generateApiKeySecret();
  const apiKey = await pb
    .collection("api_keys")
    .create({ key_hash: hashApiKey(keySecret), user: userId, label });

  return `${apiKey.id}.${keySecret}`;
};
