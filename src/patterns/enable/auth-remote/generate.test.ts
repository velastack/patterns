import { describe, expect, it } from "vitest";
import { compile } from "svelte/compiler";
import type { Options } from "../../../core/types";
import { generate } from "./generate";

const options: Options = {
  argv: [],
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
  },
  input: {},
};

async function settingsFile(name: string): Promise<string> {
  const { creates } = await generate(options);
  return creates.find(
    (file) => file.path === `src/routes/(app)/settings/${name}`,
  )!.content;
}

describe("enable auth-remote settings page", () => {
  it("starts the profile form from the saved user", async () => {
    const page = await settingsFile("+page.svelte");

    expect(page).toContain(
      '{...updateProfileForm.fields.name.as("text", data.user.name)}',
    );
    expect(page.replace(/\s+/g, " ")).toContain(
      'updateProfileForm.fields.emailVisibility.as( "checkbox", data.user.emailVisibility, )',
    );
    // No profile control is left without a starting value: a blank one is
    // saved as blank. The avatar is a file, which has none to give.
    expect(
      page.match(/updateProfileForm\.fields\.\w+\.as\("[a-z]+"\)/g),
    ).toEqual(['updateProfileForm.fields.avatar.as("file")']);
  });

  it("compiles without warnings", async () => {
    const { warnings } = compile(await settingsFile("+page.svelte"), {
      filename: "+page.svelte",
      generate: false,
    });
    expect(warnings).toEqual([]);
  });

  it("writes an unticked email visibility as false, for accounts that have the box", async () => {
    const remote = await settingsFile("form.remote.ts");

    expect(remote).toContain(
      "...(user.email ? { emailVisibility: data.emailVisibility ?? false } : {}),",
    );
    expect(remote).not.toContain("emailVisibility: data.emailVisibility,");
  });
});
