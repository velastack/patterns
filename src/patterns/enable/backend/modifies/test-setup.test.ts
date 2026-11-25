import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Project } from "ts-morph";
import { WITH_BACKEND, authenticateUserHelper } from "./test-setup";

describe("the default test/setup.ts", () => {
  it("signs the agent in with the pb_auth cookie, not through the login page", () => {
    expect(WITH_BACKEND).toContain(
      authenticateUserHelper("servers.pocketbaseUrl"),
    );
    expect(WITH_BACKEND).toContain(
      "const client = new PocketBase(servers.pocketbaseUrl);",
    );
    expect(WITH_BACKEND).toContain(
      "agent.set('Cookie', client.authStore.exportToCookie().split(';')[0]);",
    );
    expect(WITH_BACKEND).not.toContain("/login");
    expect(WITH_BACKEND).not.toContain(".post(");
  });

  it("is valid TypeScript with exactly one authenticateUser", () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile("/setup.ts", WITH_BACKEND);
    expect(
      project.getProgram().getSyntacticDiagnostics(sourceFile),
    ).toHaveLength(0);
    expect(sourceFile.getFunctions().map((fn) => fn.getName())).toEqual([
      "authenticateUser",
    ]);
  });

  it("is what the preview shows", () => {
    expect(
      fs.readFileSync(
        path.join(import.meta.dirname, "..", "preview-modifies/test/setup.ts"),
        "utf8",
      ),
    ).toBe(WITH_BACKEND);
  });
});
