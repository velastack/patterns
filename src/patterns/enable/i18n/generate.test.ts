import { describe, expect, it } from "vitest";
import type { Features, Options } from "../../../core/types";
import { generate } from "./generate";

function makeOptions(ui?: Features["ui"]): Options {
  return {
    argv: [],
    env: "runtime",
    root: "/tmp/project",
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
      ui,
    },
    input: {},
  };
}

const LANGUAGE_SELECT = "src/lib/components/language-select.svelte";

function languageSelect(result: Awaited<ReturnType<typeof generate>>) {
  return result.creates.find((file) => file.path === LANGUAGE_SELECT)!.content;
}

describe("enable i18n generate", () => {
  it("builds the language select on the shadcn select", async () => {
    const result = await generate(makeOptions("shadcn"));

    expect(result.components).toEqual(["select"]);
    expect(languageSelect(result)).toContain("<Select.Root");
  });

  it("defaults to shadcn when the ui is not detected", async () => {
    const result = await generate(makeOptions());

    expect(result.components).toEqual(["select"]);
    expect(languageSelect(result)).toContain("<Select.Root");
  });

  it("uses a native <select> and no components in a plain project", async () => {
    const result = await generate(makeOptions("plain"));

    expect(result.components).toEqual([]);
    const component = languageSelect(result);
    expect(component).toContain("<select");
    expect(component).not.toContain("$lib/components/ui");
  });

  it("creates the same files whatever the ui", async () => {
    const paths = async (ui: Features["ui"]) =>
      (await generate(makeOptions(ui))).creates.map((file) => file.path);

    expect(await paths("plain")).toEqual(await paths("shadcn"));
  });
});
