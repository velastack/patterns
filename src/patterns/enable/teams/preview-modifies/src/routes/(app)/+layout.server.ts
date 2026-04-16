export const load = async ({ locals, depends }) => {
  const user = locals.pb.authStore.record!;
  // [!code highlight:3]
  const team = locals.team;
  const teams = await locals.pb.collection("teams").getFullList();
  depends("app:team");

  const breadcrumbs = [{ title: "Home", url: "/dashboard" }];

  return { user, team, teams, breadcrumbs };
};
