import { describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { generate, resolveMode } from "./generate";

const HOSTED = "https://velastack.dev/v1/projects/demo/cms";

const BACKEND_FILES = [
  "src/lib/server/cms.ts",
  "src/routes/api/cms/[...path]/+server.ts",
  "src/routes/uploads/[filename]/+server.ts",
];

function makeOptions(
  overrides: {
    backend?: boolean;
    i18n?: boolean;
    input?: Record<string, unknown>;
    argv?: string[];
  } = {},
): Options {
  return {
    argv: overrides.argv ?? [],
    env: "preview",
    root: "/tmp/project",
    features: {
      auth: false,
      api: false,
      apiKeys: false,
      backend: overrides.backend ?? true,
      i18n: overrides.i18n ?? false,
      teams: false,
      payments: false,
      blog: false,
      contentNegotiation: false,
      cms: false,
    },
    input: overrides.input ?? {},
  };
}

function libSource(result: Awaited<ReturnType<typeof generate>>): string {
  const file = result.creates.find((f) => f.path === "src/lib/cms.ts");
  expect(file).toBeDefined();
  return file!.content;
}

describe("enable cms generate", () => {
  it("hosts the backend itself when the app has a server", async () => {
    const result = await generate(makeOptions());
    const paths = result.creates.map((f) => f.path);

    for (const file of BACKEND_FILES) expect(paths).toContain(file);
    expect(libSource(result)).toContain("endpoint: '/api/cms'");
    expect(result.packages).toContain("better-sqlite3");
  });

  it("reads from a hosted CMS when --endpoint is given", async () => {
    const result = await generate(
      makeOptions({ input: { endpoint: `${HOSTED}/` } }),
    );
    const paths = result.creates.map((f) => f.path);

    expect(paths).toEqual(["src/lib/cms.ts"]);
    expect(libSource(result)).toContain(`endpoint: '${HOSTED}'`);
    expect(result.packages).not.toContain("better-sqlite3");
    expect(result.packages).toContain("marked");
  });

  it("takes --endpoint from argv when it was not parsed for it", () => {
    expect(resolveMode(makeOptions({ argv: ["--endpoint", HOSTED] }))).toEqual({
      endpoint: HOSTED,
      local: false,
    });
    expect(
      resolveMode(makeOptions({ argv: [`--endpoint=${HOSTED}`] })),
    ).toEqual({ endpoint: HOSTED, local: false });
  });

  it("lets a static site use a hosted CMS", async () => {
    const result = await generate(
      makeOptions({ backend: false, input: { endpoint: HOSTED } }),
    );
    expect(result.creates.map((f) => f.path)).toEqual(["src/lib/cms.ts"]);
  });

  it("refuses a static site without an endpoint", async () => {
    await expect(generate(makeOptions({ backend: false }))).rejects.toThrow(
      InvalidArgumentError,
    );
    await expect(generate(makeOptions({ backend: false }))).rejects.toThrow(
      /--endpoint/,
    );
  });

  it("rejects an endpoint that is not an absolute URL", () => {
    expect(() =>
      resolveMode(makeOptions({ input: { endpoint: "/api/cms" } })),
    ).toThrow(InvalidArgumentError);
  });

  it("takes locales from wuchale when i18n is on", async () => {
    const result = await generate(makeOptions({ i18n: true }));
    const source = libSource(result);

    expect(source).toContain("import { locales } from '$locales/data';");
    expect(source).toContain("locales: [...locales]");
  });
});
