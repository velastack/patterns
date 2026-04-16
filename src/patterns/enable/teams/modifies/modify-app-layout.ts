import fs from "node:fs";

export function modifyAppLayoutSvelte(layoutPath: string): boolean {
  if (!fs.existsSync(layoutPath)) {
    return false;
  }

  let s = fs.readFileSync(layoutPath, "utf8");
  if (s.includes("teams={data.teams")) {
    return false;
  }

  const before = "<AppSidebar user={data.user} meta={data.meta} />";
  const after =
    "<AppSidebar user={data.user} meta={data.meta} team={data.team} teams={data.teams ?? []} />";

  if (!s.includes(before)) {
    return false;
  }

  s = s.replace(before, after);
  fs.writeFileSync(layoutPath, s, "utf8");
  return true;
}
