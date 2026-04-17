import { z } from "zod";
import type { Schemas } from "@velastack/pocketbase";

export const apiKeySchema = z.object({
  label: z.string().optional(),
}) satisfies Schemas["api_keys"];
