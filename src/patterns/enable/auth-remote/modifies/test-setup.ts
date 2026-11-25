import fs from "node:fs";
import { Project } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";
import { authenticateUserHelper } from "../../backend/modifies/test-setup";

/**
 * A test setup from before the cookie helper was the default logs in by
 * posting the `/login` form action, which this pattern replaces with a remote
 * function. That helper is swapped for the current one; a project that
 * already has it, has none, or wrote its own has nothing to fix.
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

  // Setups older than `vela/testing` have no `servers`, only the environment.
  const pocketbaseUrl = sourceFile.getVariableDeclaration("servers")
    ? "servers.pocketbaseUrl"
    : "process.env.POCKETBASE_URL!";
  helper.replaceWithText(authenticateUserHelper(pocketbaseUrl));
  sourceFile.saveSync();
  return { status: "success", changed: true };
}
