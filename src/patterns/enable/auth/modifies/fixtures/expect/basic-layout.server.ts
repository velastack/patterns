export const load = async ({ locals }) => {
  // there might be some code here
  return {
    user: locals.pb.authStore.record,
  };
};
