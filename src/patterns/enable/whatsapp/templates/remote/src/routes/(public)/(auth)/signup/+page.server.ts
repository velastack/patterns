import { redirect } from "@sveltejs/kit";
import { whatsappAuthMethod } from "#lib/server/whatsapp.js";

export const load = async ({ locals }) => {
  const authMethods = await locals.admin.collection("users").listAuthMethods();

  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  const whatsapp = whatsappAuthMethod(authMethods);

  return {
    authMethods,
    whatsappSignup: whatsapp.enabled && whatsapp.allowSignup === true,
  };
};
