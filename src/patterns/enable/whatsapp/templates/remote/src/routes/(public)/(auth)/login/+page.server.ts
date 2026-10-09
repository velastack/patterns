import { redirect } from "@sveltejs/kit";
import { whatsappAuthMethod } from "#lib/server/whatsapp.js";

export const load = async ({ locals }) => {
  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  const authMethods = await locals.admin.collection("users").listAuthMethods();

  return { authMethods, whatsapp: whatsappAuthMethod(authMethods) };
};
