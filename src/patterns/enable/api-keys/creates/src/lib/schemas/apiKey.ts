import { z } from "zod/v3";
import type { Schemas } from "pocketbase-svelte";

export const apiKeySchema = z.object({
  label: z.string().optional(),
}) satisfies Schemas["api_keys"];
