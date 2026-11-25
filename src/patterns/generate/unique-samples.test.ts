import { describe, expect, it, vi } from "vitest";
import type { Options, Result } from "../../core/types";
import { generate as scaffold } from "./scaffold/generate";
import { generate as scaffoldRemote } from "./scaffold-remote/generate";

vi.mock("../../parse/env.preview", () => ({
  getPreviewCollections: () => [],
}));

const features: Options["features"] = {
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
};

// The generated server tests create several records. With one fixed sample
// per field, the second create of a unique field fails with
// `validation_not_unique`.
describe("sample values for unique fields in generated tests", () => {
  it.each<[string, (options: Options) => Promise<Result>]>([
    ["scaffold", scaffold],
    ["scaffold --remote", scaffoldRemote],
  ])("%s gives each record its own value", async (_, generate) => {
    const result = await generate({
      argv: ["song", "title:text!", "code:text!:unique", "rank:number:unique"],
      env: "preview",
      root: "/tmp/project",
      features,
      input: {},
    });

    const tests = result.creates.filter((file) =>
      file.path.endsWith("server.test.ts"),
    );
    expect(tests.length).toBeGreaterThan(0);
    for (const file of tests) {
      expect(file.content).not.toContain('"code value"');
      expect(file.content).not.toContain("'code value'");
      expect(file.content).toContain("code-${crypto.randomUUID()");
      expect(file.content).toContain("Math.floor(Math.random() * 1e9)");
      // A field that is not unique keeps its readable sample.
      expect(file.content).toMatch(/title value/);
    }
  });
});
