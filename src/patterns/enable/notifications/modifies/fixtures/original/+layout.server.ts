export const load = ({ locals }) => {
  const user = locals.pb.authStore.record!;
  const breadcrumbs = [{ title: "Home", url: "/dashboard" }];

  return { user, breadcrumbs };
};
