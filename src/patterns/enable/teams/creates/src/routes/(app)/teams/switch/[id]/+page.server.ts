import { error, redirect } from "@sveltejs/kit";
import { dev } from "$app/environment";

export const load = async ({ params, cookies, url, locals }) => {
  const { id } = params;
  const redirectUrl = url.searchParams.get("redirect") ?? "/dashboard";

  try {
    await locals.pb.collection("teams").getOne(id);
  } catch {
    return error(404, { message: "Team not found" });
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
