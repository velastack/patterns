import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

import { modifyHooksServerBackend } from "../../../enable/backend/modifies/hooks.server";
import { modifyHooksServerI18n } from "../../../enable/i18n/modifies/hooks.server";
import { unmodifyHooksServerI18n } from "../../i18n/modifies/hooks.server";
import { revertOutcomeToFile } from "../../../../runtime/modify-file";
import { unmodifyHooksServerBackend } from "./hooks.server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const expected = (name: string) =>
  fs.readFileSync(path.join(fixturesPath, "expect", name), "utf8");

describe("disable backend hooks.server.ts", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("empties the minimal template's hooks, so the runtime deletes them", () => {
    const filePath = path.join(tempDir, "minimal.hooks.server.ts");

    const outcome = unmodifyHooksServerBackend(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    const reverted = revertOutcomeToFile(filePath, outcome);
    expect(reverted.modify).toBeNull();
    expect(reverted.delete?.path).toBe(filePath);
  });

  it("keeps the i18n handle, dropping the PocketBase handle and the worker", async () => {
    const filePath = path.join(tempDir, "minimal-i18n.hooks.server.ts");

    const outcome = unmodifyHooksServerBackend(filePath);

    expect(outcome).toEqual({ status: "success", changed: true });
    expect(revertOutcomeToFile(filePath, outcome).delete).toBeNull();
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("minimal-i18n.hooks.server.ts"),
      "hooks.server.ts",
    );
  });

  it("leaves an init that does not start the worker", async () => {
    const filePath = path.join(tempDir, "other-init.hooks.server.ts");
    unmodifyHooksServerBackend(filePath);
    await expect(fs.readFileSync(filePath, "utf8")).toMatchFormatted(
      expected("other-init.hooks.server.ts"),
      "hooks.server.ts",
    );
  });

  it("reports failure for an init that does more than start the worker", () => {
    const filePath = path.join(tempDir, "custom-init.hooks.server.ts");
    const before = fs.readFileSync(filePath, "utf8");

    const outcome = unmodifyHooksServerBackend(filePath);

    expect(outcome.status).toBe("failed");
    if (outcome.status === "failed") {
      expect(outcome.message).toContain("startWorker");
    }
    expect(fs.readFileSync(filePath, "utf8")).toBe(before);
  });

  it("is idempotent", () => {
    const filePath = path.join(tempDir, "minimal-i18n.hooks.server.ts");
    unmodifyHooksServerBackend(filePath);
    const once = fs.readFileSync(filePath, "utf8");

    expect(unmodifyHooksServerBackend(filePath)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.readFileSync(filePath, "utf8")).toBe(once);
  });

  it("does nothing without a hooks.server.ts", () => {
    expect(
      unmodifyHooksServerBackend(path.join(tempDir, "missing.ts")),
    ).toEqual({ status: "success", changed: false });
  });

  it("round-trips a static site with i18n through enable and disable backend", async () => {
    const filePath = path.join(tempDir, "static-i18n.hooks.server.ts");
    fs.writeFileSync(
      filePath,
      fs.readFileSync(
        path.join(
          __dirname,
          "../../../enable/backend/modifies/fixtures/original/static-i18n.hooks.server.ts",
        ),
        "utf8",
      ),
    );

    modifyHooksServerBackend(filePath);
    unmodifyHooksServerBackend(filePath);

    // handleStatic() is not put back: the backend's handle replaced it.
    const modified = fs.readFileSync(filePath, "utf8");
    expect(modified).toContain("export const handle = handleWuchale;");
    expect(modified).not.toContain("handlePocketbase");
    expect(modified).not.toContain("$env/dynamic/private");
    expect(modified).not.toContain("sequence");

    // And disabling i18n afterwards empties it.
    unmodifyHooksServerI18n(filePath);
    expect(fs.readFileSync(filePath, "utf8").trim()).toBe("");
  });

  it("round-trips i18n enabled on top of the backend, disabled in either order", () => {
    for (const order of [
      ["backend", "i18n"],
      ["i18n", "backend"],
    ]) {
      const filePath = path.join(tempDir, `order-${order[0]}.hooks.server.ts`);
      fs.copyFileSync(path.join(tempDir, "minimal.hooks.server.ts"), filePath);

      modifyHooksServerI18n(filePath);
      for (const step of order) {
        if (step === "backend") unmodifyHooksServerBackend(filePath);
        else unmodifyHooksServerI18n(filePath);
      }

      expect(fs.readFileSync(filePath, "utf8").trim()).toBe("");
    }
  });
});
