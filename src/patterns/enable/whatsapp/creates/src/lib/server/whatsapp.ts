/**
 * WhatsApp one-time code auth, from the pocketbase-whatsapp plugin that
 * velabase ships. The SDK has no methods for it, so these call the plugin
 * routes directly.
 */

/**
 * The `whatsapp` entry the plugin adds to `listAuthMethods()`.
 *
 * Vanilla PocketBase has no such entry, which reads as disabled.
 */
export type WhatsAppAuthMethod = {
  enabled: boolean;
  /**
   * Whether unknown numbers can sign up. Plugin versions without the flag
   * leave it out, which hides WhatsApp on the signup page.
   */
  allowSignup?: boolean;
  codeLength: number;
  duration: number;
};

export function whatsappAuthMethod(authMethods: object): WhatsAppAuthMethod {
  const whatsapp = (authMethods as { whatsapp?: WhatsAppAuthMethod })
    .whatsapp;
  return whatsapp ?? { enabled: false, codeLength: 6, duration: 300 };
}

/**
 * Sends a code to `phone` (international format, eg. +16165550123).
 *
 * Unknown numbers still get an `otpId` when signup is off, so the response
 * never tells whether the number has an account.
 */
export async function requestWhatsAppOTP(
  pb: App.Locals["pb"],
  phone: string,
  lang?: string,
): Promise<{ otpId: string }> {
  return pb.send("/api/collections/users/request-whatsapp-otp", {
    method: "POST",
    body: { phone, ...(lang ? { lang } : {}) },
  });
}

/**
 * Checks the code and signs `pb` in. `isNew` is true when the code created
 * the account (signup on), so the caller can run its new user setup.
 */
export async function authWithWhatsApp(
  pb: App.Locals["pb"],
  otpId: string,
  code: string,
): Promise<{ isNew: boolean }> {
  const auth = await pb.send("/api/collections/users/auth-with-whatsapp", {
    method: "POST",
    body: { otpId, password: code },
  });
  // Unlike the SDK auth methods, `send` leaves the auth store alone.
  pb.authStore.save(auth.token, auth.record);
  return { isNew: !!auth.meta?.isNew };
}
