export const load = async ({ depends, locals }) => {
  const user = locals.pb.authStore.record!;
  const team = locals.team;
  const teams = await locals.pb.collection("teams").getFullList();
  depends("app:team");
  const breadcrumbs = [{ title: "Home", url: "/dashboard" }];

  return {
    user,
    breadcrumbs,
    team,
    teams,
  };
};
