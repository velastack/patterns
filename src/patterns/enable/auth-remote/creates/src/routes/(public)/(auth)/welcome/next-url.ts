/**
 * Where to go after the name step. Follows only a same-site path (`/x`, not
 * `//host` or `/\host`): `redirect()` throws on an external URL.
 */
export function nextUrl(url: URL) {
  const next = url.searchParams.get("redirect");
  return next && /^\/(?![/\\])/.test(next) ? next : "/dashboard";
}
