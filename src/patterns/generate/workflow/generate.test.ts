import { describe, expect, it } from "vitest";
import { InvalidArgumentError } from "../../../core/errors";
import { generate, parseWorkflowArgs } from "./generate";
import type { Options } from "../../../core/types";

const options = (argv: string[]): Options => ({
  argv,
  env: "preview",
  root: "/tmp/project",
  features: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: true,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
    cms: false,
    workflows: true,
  },
  input: {},
});

describe("parseWorkflowArgs", () => {
  it("accepts kebab-case", () => {
    expect(parseWorkflowArgs(["send-welcome-email"])).toEqual({
      name: "send-welcome-email",
      exportName: "sendWelcomeEmail",
      cron: undefined,
    });
  });

  it("normalises camelCase, PascalCase and snake_case", () => {
    expect(parseWorkflowArgs(["sendWelcomeEmail"]).name).toBe(
      "send-welcome-email",
    );
    expect(parseWorkflowArgs(["SendWelcomeEmail"]).name).toBe(
      "send-welcome-email",
    );
    expect(parseWorkflowArgs(["send_welcome_email"]).name).toBe(
      "send-welcome-email",
    );
  });

  it("reads --cron in both spellings and either order", () => {
    expect(parseWorkflowArgs(["sync", "--cron", "*/5 * * * *"]).cron).toBe(
      "*/5 * * * *",
    );
    expect(parseWorkflowArgs(["--cron=0 3 * * *", "nightly"])).toEqual({
      name: "nightly",
      exportName: "nightly",
      cron: "0 3 * * *",
    });
  });

  it("rejects a missing name, a bad name, a bad schedule and unknown options", () => {
    expect(() => parseWorkflowArgs([])).toThrow(InvalidArgumentError);
    expect(() => parseWorkflowArgs(["9lives"])).toThrow(InvalidArgumentError);
    expect(() => parseWorkflowArgs(["a", "b"])).toThrow(InvalidArgumentError);
    expect(() => parseWorkflowArgs(["sync", "--cron", "hourly"])).toThrow(
      InvalidArgumentError,
    );
    expect(() => parseWorkflowArgs(["sync", "--cron"])).toThrow(
      InvalidArgumentError,
    );
    expect(() => parseWorkflowArgs(["sync", "--route", "x"])).toThrow(
      InvalidArgumentError,
    );
  });
});

describe("generate workflow", () => {
  it("writes the workflow and a server test next to it", async () => {
    const result = await generate(options(["send-welcome-email"]));
    expect(result.creates.map((f) => f.path)).toEqual([
      "src/lib/workflows/send-welcome-email.ts",
      "src/lib/workflows/send-welcome-email.server.test.ts",
    ]);
    const [workflow, test] = result.creates;
    expect(workflow.content).toContain(
      "export const sendWelcomeEmail = ow.defineWorkflow(",
    );
    expect(workflow.content).toContain("name: 'send-welcome-email'");
    expect(workflow.content).toContain("schema: z.object({})");
    expect(workflow.content).not.toContain("export const cron");
    expect(test.content).toContain("sendWelcomeEmail.run({})");
    expect(test.content).toContain("resolves.toEqual({})");
  });

  it("writes a recurring workflow when --cron is given", async () => {
    const result = await generate(
      options(["sync-prices", "--cron", "*/5 * * * *"]),
    );
    const [workflow, test] = result.creates;
    expect(workflow.content).toContain("export const cron = '*/5 * * * *';");
    expect(workflow.content).not.toContain("schema:");
    expect(workflow.content).not.toContain("from 'zod'");
    expect(test.content).toContain("syncPrices.run()");
    expect(test.content).toContain("resolves.toBeNull()");
  });
});
