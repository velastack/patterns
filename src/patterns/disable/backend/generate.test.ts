import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Options } from "../../../core/types";
import { envVarsFile } from "../../../runtime/env-vars-file";
import { WORKFLOWS_ENV_VARS } from "../../enable/workflows/env-vars";
import { generate } from "./generate";
import { generate as generateRuntime } from "./generate.runtime";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/** A project with the minimal template's `src/env.ts` plus one entry of its own. */
function makeRoot({ workflows }: { workflows: boolean }): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-disable-backend-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, "src", "lib", "server"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "src", "env.ts"),
    envVarsFile([...WORKFLOWS_ENV_VARS, { name: "MY_KEY" }]),
  );
  if (workflows) {
    fs.writeFileSync(
      path.join(root, "src", "lib", "server", "workflows.ts"),
      "export {};\n",
    );
  }
  return root;
}

function runtimeOptions(root: string): Options {
  return {
    argv: [],
    env: "runtime",
    root,
    features: { backend: true } as Options["features"],
    input: {},
  };
}

function declared(source: string): string[] {
  return [...source.matchAll(/^\t(\w+): \{/gm)].map((m) => m[1]);
}

describe("disable backend pattern", () => {
  it("removes the workflows along with the backend they run on", async () => {
    const result = await generate({} as Options);
    const deleted = result.deletes.map((file) => file.path);

    expect(deleted).toEqual(
      expect.arrayContaining([
        "data",
        "src/hooks.server.ts",
        // The runtime reads `App.Locals["admin"]`, and every workflow module
        // imports `ow` from it: neither type-checks without the backend.
        "src/lib/server/workflows.ts",
        "src/lib/workflows",
      ]),
    );
    expect(result.uninstalls).toEqual([
      "openworkflow",
      "openworkflow-pocketbase",
      "croner",
    ]);
  });

  it("drops the workflow switches from src/env.ts with the runtime that read them", async () => {
    const root = makeRoot({ workflows: true });
    const result = await generateRuntime(runtimeOptions(root));
    const env = result.modifies.find((file) => file.path.endsWith("env.ts"));
    expect(env && declared(env.content)).toEqual(["MY_KEY"]);
  });

  it("keeps TEST and the workflow switches when there was no workflow runtime", async () => {
    const root = makeRoot({ workflows: false });
    const result = await generateRuntime(runtimeOptions(root));
    const env = result.modifies.find((file) => file.path.endsWith("env.ts"));
    expect(env && declared(env.content)).toEqual([
      "WORKFLOWS_ENABLED",
      "WORKFLOWS_CONCURRENCY",
      "TEST",
      "MY_KEY",
    ]);
  });
});
