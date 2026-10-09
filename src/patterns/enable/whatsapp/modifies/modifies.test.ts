import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import prettier from "prettier";
import sveltePlugin from "prettier-plugin-svelte";

import { pageGroups, swapAuthPages, type Mode } from "./auth-pages";
import { modifyTestSetup } from "./modify-test-setup";
import { modifyUserSignup } from "../../payments/modifies/modify-user-signup";
import { unmodifyUserSignup } from "../../../disable/payments/modifies/modify-user-signup";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const patterns = path.resolve(__dirname, "../../..");
const fixturesPath = path.join(__dirname, "fixtures");
const tempDir = path.join(__dirname, "temp");

const SOURCES = {
  base: [path.join(patterns, "enable/auth/creates")],
  split: [
    path.join(patterns, "enable/auth/variants/split"),
    path.join(patterns, "enable/auth/creates"),
  ],
  remote: [path.join(patterns, "enable/auth-remote/creates")],
  legacy: [
    path.join(__dirname, "../originals/auth-1.1/base"),
    path.join(patterns, "enable/auth/creates"),
  ],
};
const TEMPLATES = {
  base: [path.join(__dirname, "../templates/base")],
  split: [
    path.join(__dirname, "../templates/split"),
    path.join(__dirname, "../templates/base"),
  ],
  remote: [path.join(__dirname, "../templates/remote")],
};

const modeOf = (shape: keyof typeof SOURCES): Mode =>
  shape === "remote" ? "remote" : "superforms";

function allFiles(mode: Mode): string[] {
  return Object.values(pageGroups(mode)).flat();
}

/** The first of `dirs` that has `rel`. */
function read(dirs: string[], rel: string): string {
  const dir = dirs.find((d) => fs.existsSync(path.join(d, rel)));
  if (!dir) throw new Error(`No ${rel} in ${dirs.join(", ")}`);
  return fs.readFileSync(path.join(dir, rel), "utf8");
}

function writeProject(shape: keyof typeof SOURCES) {
  for (const rel of allFiles(modeOf(shape))) {
    const file = path.join(tempDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, read(SOURCES[shape], rel));
  }
}

const hint = (file: string) => `hint for ${path.basename(file)}`;

describe("swapAuthPages", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  for (const shape of ["base", "split", "remote"] as const) {
    it(`swaps the ${shape} pages in and back out`, async () => {
      writeProject(shape);
      const files = allFiles(modeOf(shape));

      const enabled = await swapAuthPages(tempDir, "enable", hint);
      for (const rel of files) {
        expect(enabled.get(path.join(tempDir, rel))).toEqual({
          status: "success",
          changed: true,
        });
        expect(fs.readFileSync(path.join(tempDir, rel), "utf8")).toBe(
          read(TEMPLATES[shape], rel),
        );
      }

      // Already swapped: nothing left to do.
      const again = await swapAuthPages(tempDir, "enable", hint);
      for (const outcome of again.values()) {
        expect(outcome).toEqual({ status: "success", changed: false });
      }

      const disabled = await swapAuthPages(tempDir, "disable", hint);
      for (const rel of files) {
        expect(disabled.get(path.join(tempDir, rel))).toEqual({
          status: "success",
          changed: true,
        });
        expect(fs.readFileSync(path.join(tempDir, rel), "utf8")).toBe(
          read(SOURCES[shape], rel),
        );
      }
    });
  }

  it("upgrades the signup pages from before one-time codes", async () => {
    writeProject("legacy");
    const outcomes = await swapAuthPages(tempDir, "enable", hint);
    for (const rel of allFiles("superforms")) {
      expect(outcomes.get(path.join(tempDir, rel))?.status).toBe("success");
      expect(fs.readFileSync(path.join(tempDir, rel), "utf8")).toBe(
        read(TEMPLATES.base, rel),
      );
    }
  });

  it("matches pages formatted with the project's prettier config", async () => {
    writeProject("base");
    for (const rel of allFiles("superforms")) {
      const file = path.join(tempDir, rel);
      const formatted = await prettier.format(fs.readFileSync(file, "utf8"), {
        filepath: file,
        plugins: [sveltePlugin],
        useTabs: true,
        singleQuote: true,
        trailingComma: "none",
        printWidth: 100,
      });
      fs.writeFileSync(file, formatted);
    }
    const outcomes = await swapAuthPages(tempDir, "enable", hint);
    for (const outcome of outcomes.values()) {
      expect(outcome).toEqual({ status: "success", changed: true });
    }
  });

  it("leaves a customized form alone, and swaps the other", async () => {
    writeProject("base");
    const page = path.join(
      tempDir,
      "src/routes/(public)/(auth)/signup/+page.svelte",
    );
    fs.writeFileSync(
      page,
      fs.readFileSync(page, "utf8").replace("Create an account", "Join us"),
    );
    const before = Object.fromEntries(
      pageGroups("superforms").signup.map((rel) => [
        rel,
        fs.readFileSync(path.join(tempDir, rel), "utf8"),
      ]),
    );

    const outcomes = await swapAuthPages(tempDir, "enable", hint);

    expect(outcomes.get(page)).toEqual({
      status: "failed",
      message: "hint for +page.svelte",
    });
    for (const rel of pageGroups("superforms").signup) {
      // The page itself, and the rest of its form with it.
      expect(outcomes.get(path.join(tempDir, rel))?.status).toBe("failed");
      expect(fs.readFileSync(path.join(tempDir, rel), "utf8")).toBe(
        before[rel],
      );
    }
    for (const rel of pageGroups("superforms").login) {
      expect(outcomes.get(path.join(tempDir, rel))).toEqual({
        status: "success",
        changed: true,
      });
    }
  });

  it("keeps enable-payments' signup hook", async () => {
    writeProject("base");
    const server = path.join(
      tempDir,
      "src/routes/(public)/(auth)/signup/+page.server.ts",
    );
    expect(modifyUserSignup(server)).toEqual({
      status: "success",
      changed: true,
    });

    const outcomes = await swapAuthPages(tempDir, "enable", hint);
    expect(outcomes.get(server)).toEqual({ status: "success", changed: true });
    const content = fs.readFileSync(server, "utf8");
    expect(content).toContain("requestWhatsAppOTP");
    expect(content).toContain("linkStripeCustomer.run(");

    const disabled = await swapAuthPages(tempDir, "disable", hint);
    expect(disabled.get(server)).toEqual({ status: "success", changed: true });
    const reverted = fs.readFileSync(server, "utf8");
    expect(reverted).not.toContain("WhatsApp");
    expect(reverted).toContain("linkStripeCustomer.run(");
  });

  it("swaps a signup action that had payments enabled, then disabled", async () => {
    writeProject("base");
    const server = path.join(
      tempDir,
      "src/routes/(public)/(auth)/signup/+page.server.ts",
    );
    expect(modifyUserSignup(server).status).toBe("success");
    expect(unmodifyUserSignup(server).status).toBe("success");

    const outcomes = await swapAuthPages(tempDir, "enable", hint);
    expect(outcomes.get(server)).toEqual({ status: "success", changed: true });
    expect(fs.readFileSync(server, "utf8")).toBe(
      read(TEMPLATES.base, "src/routes/(public)/(auth)/signup/+page.server.ts"),
    );
  });

  it("reports a missing page", async () => {
    writeProject("base");
    const page = path.join(
      tempDir,
      "src/routes/(public)/(auth)/login/+page.svelte",
    );
    fs.rmSync(page);
    const outcomes = await swapAuthPages(tempDir, "enable", hint);
    expect(outcomes.get(page)?.status).toBe("not-found");
  });
});

describe("modifyTestSetup", () => {
  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.cpSync(path.join(fixturesPath, "original"), tempDir, {
      recursive: true,
    });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  for (const name of ["test-setup.ts", "test-setup-remote.ts"]) {
    it(`takes an optional email in ${name}`, async () => {
      const file = path.join(tempDir, name);
      expect(modifyTestSetup(file)).toEqual({
        status: "success",
        changed: true,
      });
      expect(fs.readFileSync(file, "utf8")).toBe(
        fs.readFileSync(path.join(fixturesPath, "expect", name), "utf8"),
      );
      expect(modifyTestSetup(file)).toEqual({
        status: "success",
        changed: false,
      });
    });
  }

  it("leaves a project without a test setup alone", () => {
    expect(modifyTestSetup(path.join(tempDir, "missing.ts"))).toEqual({
      status: "success",
      changed: false,
    });
  });
});
