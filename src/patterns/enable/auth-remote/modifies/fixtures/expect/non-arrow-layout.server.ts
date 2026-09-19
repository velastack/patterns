export function load({ locals }) {
  return {
    team: locals.team,
    user: locals.pb.authStore.record,
  };
}
