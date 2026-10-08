import { form, getRequestEvent } from "$app/server";
import { error } from "@sveltejs/kit";
import { setFlash } from "sveltekit-flash-message/server";
import { profileSchema } from "#lib/schemas/profile.js";
import { changeEmailSchema } from "#lib/schemas/changeEmail.js";
import { changePasswordSchema } from "#lib/schemas/changePassword.js";

export const updateProfileForm = form(profileSchema, async (data) => {
  const { locals, cookies } = getRequestEvent();

  await locals.pb.collection("users").update(locals.pb.authStore.record!.id, {
    name: data.name,
    avatar: data.avatar,
    emailVisibility: data.emailVisibility,
  });

  setFlash(
    { type: "toast", message: "Profile updated successfully." },
    cookies,
  );
  return { success: true };
});

export const changeEmailForm = form(changeEmailSchema, async (data) => {
  const { locals, cookies } = getRequestEvent();

  await locals.pb.collection("users").requestEmailChange(data.email);
  setFlash(
    {
      type: "toast",
      message: "We sent a confirmation link to your new email.",
    },
    cookies,
  );
  return { success: true };
});

export const changePasswordForm = form(changePasswordSchema, async (data) => {
  const { locals, cookies } = getRequestEvent();

  await locals.admin
    .collection("users")
    .update(locals.pb.authStore.record!.id, {
      password: data.password,
      passwordConfirm: data.passwordConfirm,
    });

  setFlash(
    { type: "toast", message: "Password updated successfully." },
    cookies,
  );
  return { success: true };
});

export const resendVerificationForm = form(async () => {
  const { locals, cookies } = getRequestEvent();
  // Accounts made with a phone number may have no email to verify.
  const email = locals.pb.authStore.record?.email;
  if (!email) {
    error(400, "Your account has no email.");
  }

  await locals.pb.collection("users").requestVerification(email);
  setFlash(
    { type: "toast", message: "We sent a verification email to your email." },
    cookies,
  );
  return { success: true };
});
