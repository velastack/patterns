import { describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { generate } from "./generate";
import { generate as generateDisable } from "../../disable/og/generate";
import { spec } from "../../../core/versions";

const options: Options = {
  argv: [],
  env: "preview",
  root: "",
  features: {
    auth: false,
    api: false,
    apiKeys: false,
    backend: false,
    i18n: false,
    teams: false,
    payments: false,
    blog: false,
    contentNegotiation: false,
    cms: false,
  },
  input: {},
};

describe("enable-og", () => {
  it("writes the card, its renderer and the image route", async () => {
    const result = await generate(options);
    expect(result.creates.map((f) => f.path)).toEqual([
      "src/lib/og/card.svelte",
      "src/lib/og/index.ts",
      "src/lib/server/og.ts",
      "src/routes/og/[...path].png/+server.ts",
    ]);
  });

  it("installs the renderer and nothing else", async () => {
    expect((await generate(options)).packages).toEqual([
      spec("@takumi-rs/core"),
    ]);
  });

  it("is undone by disable-og", async () => {
    const created = (await generate(options)).creates.map((f) => f.path);
    const disabled = await generateDisable(options);
    expect(disabled.deletes.map((f) => f.path)).toEqual(created);
    expect(disabled.uninstalls).toEqual(["@takumi-rs/core"]);
  });
});
