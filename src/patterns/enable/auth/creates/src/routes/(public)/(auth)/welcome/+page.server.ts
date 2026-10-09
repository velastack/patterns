import { fail, superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { welcomeSchema } from "#lib/schemas/welcome.js";
import { redirect } from "@sveltejs/kit";

/**
 * Where to go next. Follows only a same-site path (`/x`, not `//host` or
 * `/\host`): `redirect()` throws on an external URL.
 */
function nextUrl(url: URL) {
  const next = url.searchParams.get("redirect");
  return next && /^\/(?![/\\])/.test(next) ? next : "/dashboard";
}

// Accounts made with a one-time code start without a name, so signup sends
// them here once the code checks out, to pick the name the app shows.
export const load = async ({ locals, url }) => {
  if (!locals.pb.authStore.isValid) {
    redirect(303, "/login");
  }
  if (locals.pb.authStore.record?.name) {
    redirect(303, nextUrl(url));
  }

  return { form: await superValidate(zod4(welcomeSchema)), next: nextUrl(url) };
};

export const actions = {
  default: async ({ locals, request, url }) => {
    if (!locals.pb.authStore.isValid) {
      redirect(303, "/login");
    }

    const form = await superValidate(request, zod4(welcomeSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    await locals.pb
      .collection("users")
      .update(locals.pb.authStore.record!.id, { name: form.data.name.trim() });

    redirect(303, nextUrl(url));
  },
};
