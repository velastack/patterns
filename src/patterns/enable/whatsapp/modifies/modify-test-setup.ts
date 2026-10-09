import fs from "node:fs";
import type { ModifyOutcome } from "../../../../core/types";

/**
 * `email` turns optional on `users`, which the generated types follow, so a
 * test setup from before enable-backend handled that no longer type-checks:
 * its `authenticateUser` takes `{ email: string }` and it signs the test
 * user in with `context.user.email`. Brings those two spots up to the
 * current setup; anything else in the file is the project's own.
 */
export function modifyTestSetup(setupPath: string): ModifyOutcome {
  if (!fs.existsSync(setupPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(setupPath, "utf8");
  let content = original;

  content = content.replace(
    /^([ \t]*)(async function authenticateUser\(agent: Agent, user: \{ )email: string( \}\) \{\n)([ \t]*)/m,
    (_, indent, head, tail, bodyIndent) =>
      `${indent}${head}email?: string${tail}` +
      `${bodyIndent}// Logs in with the password, so it needs the email (made optional by\n` +
      `${bodyIndent}// enable-whatsapp, for accounts that sign in with a phone number).\n` +
      `${bodyIndent}if (!user.email) {\n` +
      `${bodyIndent}${bodyIndent.includes("\t") ? "\t" : "  "}throw new Error('authenticateUser needs a user with an email');\n` +
      `${bodyIndent}}\n` +
      bodyIndent,
  );

  // The user is made with a known email: sign in with that.
  content = content.replace(
    /^([ \t]*)context\.user = await context\.admin\.collection\('users'\)\.create\(\{\n([ \t]*)email: (`test-\$\{Math\.random\(\)\.toString\(36\)\.slice\(2\)\}@example\.com`),/m,
    (_, indent, fieldIndent, value) =>
      `${indent}const email = ${value};\n` +
      `${indent}context.user = await context.admin.collection('users').create({\n` +
      `${fieldIndent}email,`,
  );
  if (content.includes("const email = `test-")) {
    content = content.replace(
      ".authWithPassword(context.user.email, testUserPassword)",
      ".authWithPassword(email, testUserPassword)",
    );
  }

  if (content === original) {
    return { status: "success", changed: false };
  }
  fs.writeFileSync(setupPath, content, "utf8");
  return { status: "success", changed: true };
}
