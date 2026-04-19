export const load = ({ locals }) => {
  return {
    user: locals.pb.authStore.record,
  };
};
