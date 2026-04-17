import { z } from "zod";

export const otpSchema = z.object({
  otp: z.string(),
});
