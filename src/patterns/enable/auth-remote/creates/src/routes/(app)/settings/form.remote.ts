import { form, getRequestEvent } from "$app/server";
import { setFlash } from "sveltekit-flash-message/server";
import { profileSchema } from "$lib/schemas/profile";
import { changeEmailSchema } from "$lib/schemas/changeEmail";
import { changePasswordSchema } from "$lib/schemas/changePassword";

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
  await locals.pb
    .collection("users")
    .requestVerification(locals.pb.authStore.record!.email);
  setFlash(
    { type: "toast", message: "We sent a verification email to your email." },
    cookies,
  );
  return { success: true };
});
