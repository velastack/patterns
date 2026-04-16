import { redirect } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";

export const GET = async ({ params, locals, cookies }) => {
  let message = "";
  let redirectPath = "";

  try {
    await locals.admin.collection("users").confirmVerification(params.token);
    message = "Email verified successfully.";
    redirectPath = "/dashboard";
  } catch (error: any) {
    message =
      "Invalid or expired verification token. Please request a new verification email.";
    redirectPath = "/login";
  }

  setFlash({ type: "toast", message }, cookies);
  redirect(303, redirectPath);
};
