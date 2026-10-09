import { z } from "zod";

// Same as enable-auth's, where a `.trim()` would eat spaces as you type
// (superforms writes the parsed value back). The form handler trims on save.
export const welcomeSchema = z.object({
  name: z
    .string()
    .max(255)
    .refine((name) => name.trim() !== "", "Enter your name")
});
