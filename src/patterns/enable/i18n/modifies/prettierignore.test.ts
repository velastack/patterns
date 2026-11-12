import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { modifyPrettierignore } from "./prettierignore";
import { unmodifyPrettierignore } from "../../../disable/i18n/modifies/prettierignore";

const TEMPLATE = ["# Miscellaneous", "/static/", ""].join("\n");

describe(".prettierignore for wuchale's output", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "prettierignore-"));
    file = path.join(dir, ".prettierignore");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("appends the block, once, and disable takes it back", () => {
    fs.writeFileSync(file, TEMPLATE);

    expect(modifyPrettierignore(file)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(file, "utf8")).toBe(
      `${TEMPLATE}\n# Wuchale\nsrc/locales/\n`,
    );
    expect(modifyPrettierignore(file)).toEqual({
      status: "success",
      changed: false,
    });

    expect(unmodifyPrettierignore(file)).toEqual({
      status: "success",
      changed: true,
    });
    expect(fs.readFileSync(file, "utf8")).toBe(TEMPLATE);
    expect(unmodifyPrettierignore(file)).toEqual({
      status: "success",
      changed: false,
    });
  });

  it("ends an unterminated file before appending", () => {
    fs.writeFileSync(file, "/static/");
    modifyPrettierignore(file);
    expect(fs.readFileSync(file, "utf8")).toBe(
      "/static/\n\n# Wuchale\nsrc/locales/\n",
    );
  });

  it("leaves an entry the project wrote itself, on the way in and out", () => {
    const own = "/static/\n/src/locales/\n";
    fs.writeFileSync(file, own);
    const unchanged = { status: "success", changed: false };
    expect(modifyPrettierignore(file)).toEqual(unchanged);
    expect(unmodifyPrettierignore(file)).toEqual(unchanged);
    expect(fs.readFileSync(file, "utf8")).toBe(own);
  });

  it("does not create the file in a project without one", () => {
    expect(modifyPrettierignore(file)).toEqual({
      status: "success",
      changed: false,
    });
    expect(unmodifyPrettierignore(file)).toEqual({
      status: "success",
      changed: false,
    });
    expect(fs.existsSync(file)).toBe(false);
  });
});
