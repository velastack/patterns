import { error, redirect } from "@sveltejs/kit";
import { dev } from "$app/env";

export const load = async ({ params, cookies, url, locals }) => {
  const { id } = params;
  // Follow only a same-site path (`/x`, not `//host` or `/\host`):
  // `redirect()` throws on an external URL.
  const next = url.searchParams.get("redirect");
  const redirectUrl = next && /^\/(?![/\\])/.test(next) ? next : "/dashboard";

  try {
    await locals.pb.collection("teams").getOne(id);
  } catch {
    return error(404, "Team not found");
  }

  cookies.set("team", id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: !dev,
    maxAge: 60 * 60 * 24 * 30,
  });

  return redirect(303, redirectUrl);
};
