import { getTokenPayload } from "pocketbase-sveltekit";

export const load = async ({ params }) => {
  // The reset token is a JWT carrying the account email. Expose it so the
  // page can render a hidden username field for password managers.
  const { email } = getTokenPayload(params.token);

  return { email: typeof email === "string" ? email : null };
};
