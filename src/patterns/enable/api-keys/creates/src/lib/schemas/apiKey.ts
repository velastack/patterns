import { z } from "zod";
import type { Schemas } from "@velastack/pocketbase";

export const apiKeySchema = z.object({
  label: z.string(),
}) satisfies Schemas["api_keys"];
