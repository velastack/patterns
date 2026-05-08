import { redirect } from "@sveltejs/kit";

export const load = async ({ locals }) => {
  const authMethods = await locals.admin.collection("users").listAuthMethods();

  if (locals.pb.authStore.isValid) {
    redirect(303, "/dashboard");
  }

  return { authMethods };
};
