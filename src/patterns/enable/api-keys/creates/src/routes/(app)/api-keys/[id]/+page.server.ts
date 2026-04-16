import { redirect } from "@sveltejs/kit";

export const actions = {
  delete: async ({ locals, params }) => {
    await locals.pb.collection("api_keys").delete(params.id);
    redirect(303, "/api-keys");
  },
};
