import { fail, superValidate } from "sveltekit-superforms";
import { zod4 } from "sveltekit-superforms/adapters";
import { redirect } from "sveltekit-flash-message/server";
import { apiKeySchema } from "$lib/schemas/apiKey";
import { setPocketbaseErrors } from "@velastack/pocketbase";
import { createApiKey } from "./create-api-key";

export const load = async () => {
  return { form: await superValidate(zod4(apiKeySchema)) };
};

export const actions = {
  default: async ({ locals, request, cookies }) => {
    const form = await superValidate(request, zod4(apiKeySchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    let apiKey: string;

    try {
      apiKey = await createApiKey(
        locals.pb,
        locals.pb.authStore.record?.id,
        form.data.label,
      );
    } catch (error) {
      setPocketbaseErrors(form, error);
      return fail(400, { form });
    }

    return redirect(
      "/api-keys",
      {
        type: "success",
        title: "You've created a new API key",
        message: `Copy the following API key in a safe location. It will only be shown once.`,
        apiKey,
      },
      cookies,
    );
  },
};
