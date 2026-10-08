import { describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import pattern from "./index";

function makeOptions(env: Options["env"], auth: boolean): Options {
  return {
    argv: [],
    env,
    root: "/tmp/project",
    features: {
      auth,
      api: false,
      apiKeys: false,
      backend: true,
      i18n: false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
      cms: false,
    },
    input: {},
  };
}

describe("enable-whatsapp", () => {
  it("asks for enable-auth first", async () => {
    await expect(
      pattern.generate(makeOptions("runtime", false)),
    ).rejects.toThrow(InvalidArgumentError);
  });

  it("previews the code page and the base login and signup pages", async () => {
    const result = await pattern.generate(makeOptions("preview", true));
    const paths = [...result.creates, ...result.modifies].map((f) => f.path);
    expect(paths).toContain("src/lib/server/whatsapp.ts");
    expect(paths).toContain(
      "src/routes/(public)/(auth)/whatsapp/[token]/+page.server.ts",
    );
    expect(paths).toContain("src/routes/(public)/(auth)/login/+page.svelte");
    expect(paths).toContain("src/lib/schemas/signup.ts");
    expect(paths).not.toContain(
      "src/routes/(public)/(auth)/whatsapp/[token]/form.remote.ts",
    );
  });
});
