import { z } from "zod";

// No `.trim()`: superforms writes the parsed value back into the field as
// you type, which would eat every space. The action trims on save.
export const welcomeSchema = z.object({
  name: z
    .string()
    .max(255)
    .refine((name) => name.trim() !== "", "Enter your name")
});
