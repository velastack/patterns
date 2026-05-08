import { redirect } from "@sveltejs/kit";

export const load = async ({ locals }) => {
  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  const authMethods = await locals.admin.collection("users").listAuthMethods();

  return { authMethods };
};
