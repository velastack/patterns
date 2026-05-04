import { describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { generate } from "./generate";

function makeOptions(input: Record<string, unknown>): Options {
  return {
    argv: [],
    env: "preview",
    root: "/tmp/project",
    features: {
      auth: false,
      api: false,
      apiKeys: false,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
    },
    input,
  };
}

const LOGIN_PATH = "src/routes/(public)/login/+page.svelte";
const SIGNUP_PATH = "src/routes/(public)/signup/+page.svelte";

describe("auth generate (variants)", () => {
  it("returns the base creates files when no variant is selected", async () => {
    const result = await generate(makeOptions({}));
    const login = result.creates.find((f) => f.path === LOGIN_PATH);
    expect(login).toBeDefined();
    expect(login!.content).toContain('class="h-full flex flex-col');
    expect(login!.content).not.toContain("lg:grid-cols-2");
  });

  it("overrides login and signup when variant=split is selected", async () => {
    const result = await generate(makeOptions({ variant: "split" }));
    const login = result.creates.find((f) => f.path === LOGIN_PATH);
    const signup = result.creates.find((f) => f.path === SIGNUP_PATH);
    expect(login!.content).toContain("lg:grid-cols-2");
    expect(signup!.content).toContain("lg:grid-cols-2");
  });

  it("leaves sibling files (e.g. +page.server.ts) untouched in the split variant", async () => {
    const result = await generate(makeOptions({ variant: "split" }));
    const loginServer = result.creates.find(
      (f) => f.path === "src/routes/(public)/login/+page.server.ts",
    );
    expect(loginServer).toBeDefined();
    expect(loginServer!.content.length).toBeGreaterThan(0);
  });

  it("falls back to base creates when an unknown variant is provided", async () => {
    const result = await generate(makeOptions({ variant: "does-not-exist" }));
    const login = result.creates.find((f) => f.path === LOGIN_PATH);
    expect(login!.content).not.toContain("lg:grid-cols-2");
  });
});
