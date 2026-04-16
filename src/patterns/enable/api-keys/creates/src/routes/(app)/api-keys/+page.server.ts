export const load = async ({ locals }) => {
  const apiKeys = await locals.pb.collection("api_keys").getFullList();
  return { apiKeys };
};
