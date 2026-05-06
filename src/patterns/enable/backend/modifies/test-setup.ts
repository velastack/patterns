import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";

// Source of truth: velastack-cli/templates/minimal/test/setup.ts
const WITH_BACKEND = `import { beforeEach, afterEach, beforeAll } from 'vitest';
import supertest, { type Agent } from 'supertest';
import PocketBase from 'pocketbase-sveltekit';
import type { TestContext } from '@velastack/pocketbase';

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

// Source of truth: velastack-cli/templates/static/test/setup.ts
const WITHOUT_BACKEND = `import { beforeEach } from 'vitest';
import supertest from 'supertest';

beforeEach(async (context: any) => {
\tcontext.request = supertest(process.env.VITE_TEST_URL!);
\tcontext.agent = supertest.agent(process.env.VITE_TEST_URL!);
});
`;

const NOT_FOUND_HINT = dedent`
  Create test/setup.ts. The default minimal-template setup wires supertest:

  import { beforeEach } from 'vitest';
  import supertest from 'supertest';

  beforeEach(async (context: any) => {
    context.request = supertest(process.env.VITE_TEST_URL!);
    context.agent = supertest.agent(process.env.VITE_TEST_URL!);
  });
`;

export function modifyTestSetup(testSetupPath: string): ModifyOutcome {
  if (!fs.existsSync(testSetupPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
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
