import fs from "node:fs";
import path from "node:path";
import type { ModifyOutcome } from "../../../../core/types";

// Source of truth: velastack-cli/templates/minimal/test/setup.ts
export const WITH_BACKEND = `import { beforeEach, afterEach, beforeAll } from 'vitest';
import supertest, { type Agent } from 'supertest';
import PocketBase from 'pocketbase-sveltekit';
import type { TestContext } from '@velastack/pocketbase/testing';

const admin = new PocketBase(process.env.POCKETBASE_URL!) as App.Locals['admin'];
const pb = new PocketBase(process.env.POCKETBASE_URL!) as App.Locals['pb'];

const testUserPassword = 'password';

async function authenticateUser(agent: Agent, user: { email: string }) {
\tawait agent.post('/login').type('form').send({
\t\ttype: 'password',
\t\temail: user.email,
\t\tpassword: testUserPassword
\t});
}

beforeAll(async () => {
\tawait admin
\t\t// @ts-ignore
\t\t.collection('_superusers')
\t\t.authWithPassword(
\t\t\tprocess.env.POCKETBASE_SUPERUSER_EMAIL!,
\t\t\tprocess.env.POCKETBASE_SUPERUSER_PASSWORD!
\t\t);
});

beforeEach(async (context: TestContext) => {
\tcontext.request = supertest(process.env.VITE_TEST_URL!);
\tcontext.agent = supertest.agent(process.env.VITE_TEST_URL!) as TestContext['agent'];
\tcontext.admin = admin;
\tcontext.pb = pb;
\tcontext.user = await context.admin.collection('users').create({
\t\temail: \`test-\${Math.random().toString(36).slice(2)}@example.com\`,
\t\tpassword: testUserPassword,
\t\tpasswordConfirm: testUserPassword
\t});
\tcontext.agent.authenticateUser = () => authenticateUser(context.agent, context.user);
\tawait context.pb.collection('users').authWithPassword(context.user.email, testUserPassword);
});

afterEach(async (context: TestContext) => {
\tawait context.pb.authStore.clear();
\tawait context.admin.collection('users').delete(context.user.id);
});
`;

// The static template ships no test setup at all; this is the backend-free
// subset of the minimal one, kept so existing tests keep their agents.
const WITHOUT_BACKEND = `import { beforeEach } from 'vitest';
import supertest from 'supertest';

beforeEach(async (context: any) => {
\tcontext.request = supertest(process.env.VITE_TEST_URL!);
\tcontext.agent = supertest.agent(process.env.VITE_TEST_URL!);
});
`;

// Source of truth: velastack-cli/templates/minimal/vitest.config.ts
export const VITEST_CONFIG = `import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
\tviteConfig,
\tdefineConfig({
\t\ttest: {
\t\t\texpect: {
\t\t\t\trequireAssertions: true
\t\t\t},
\t\t\tname: 'server',
\t\t\tenvironment: 'node',
\t\t\tinclude: ['src/**/*.{test,spec}.{js,ts}'],
\t\t\texclude: ['src/**/*.svelte.{test,spec}.{js,ts}'],
\t\t\tsetupFiles: ['test/setup.ts']
\t\t}
\t})
);
`;

const VITEST_CONFIG_NAMES = ["ts", "mts", "js", "mjs"].flatMap((ext) => [
  `vitest.config.${ext}`,
  `vitest.workspace.${ext}`,
]);

/**
 * Whether the project already configures vitest, in a file of its own or a
 * `test` block in its vite config. Without either, `test/setup.ts` is never
 * loaded and every generated `server.test.ts` fails on its missing context.
 */
export function hasVitestConfig(root: string): boolean {
  if (
    VITEST_CONFIG_NAMES.some((name) => fs.existsSync(path.join(root, name)))
  ) {
    return true;
  }
  return ["ts", "mts", "js", "mjs"].some((ext) => {
    const viteConfig = path.join(root, `vite.config.${ext}`);
    return (
      fs.existsSync(viteConfig) &&
      /\btest\s*:/.test(fs.readFileSync(viteConfig, "utf8"))
    );
  });
}

/**
 * Brings an existing `test/setup.ts` up to the backend one. A project without
 * the file gets it as a create instead (see `generate.runtime.ts`), so it is
 * reported as created rather than modified.
 */
export function modifyTestSetup(testSetupPath: string): ModifyOutcome {
  if (!fs.existsSync(testSetupPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(testSetupPath, "utf8");
  if (original === WITH_BACKEND) {
    return { status: "success", changed: false };
  }

  fs.writeFileSync(testSetupPath, WITH_BACKEND, "utf8");
  return { status: "success", changed: true };
}

export function unmodifyTestSetup(testSetupPath: string): ModifyOutcome {
  if (!fs.existsSync(testSetupPath)) {
    return { status: "success", changed: false };
  }

  const original = fs.readFileSync(testSetupPath, "utf8");
  if (original === WITHOUT_BACKEND) {
    return { status: "success", changed: false };
  }

  fs.writeFileSync(testSetupPath, WITHOUT_BACKEND, "utf8");
  return { status: "success", changed: true };
}
