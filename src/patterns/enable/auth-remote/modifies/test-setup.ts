import fs from "node:fs";
import dedent from "dedent";
import { Project } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const COOKIE_LOGIN = dedent`
  // Login is a remote function, so there is no form action to post to: carry
  // the session the way the browser does, in the \`pb_auth\` cookie.
  async function authenticateUser(agent: Agent, user: { email: string }) {
    const client = new PocketBase(process.env.POCKETBASE_URL!);
    await client.collection("users").authWithPassword(user.email, testUserPassword);
    agent.set("Cookie", client.authStore.exportToCookie().split(";")[0]);
  }
`;

/**
 * The template's server-test helper logs in by posting the `/login` form
 * action, which this pattern replaces with a remote function. A project
 * without the helper (or with its own) has nothing to fix.
 */
export function modifyTestSetup(setupPath: string): ModifyOutcome {
  if (!fs.existsSync(setupPath)) {
    return { status: "success", changed: false };
  }

  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(setupPath);
  const helper = sourceFile.getFunction("authenticateUser");

  if (!helper || !/\.post\(\s*["'`]\/login["'`]\s*\)/.test(helper.getText())) {
    return { status: "success", changed: false };
  }

  helper.replaceWithText(COOKIE_LOGIN);
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
