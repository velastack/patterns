import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Options } from "../../../../core/types";
import { writeWhatsAppConfigMigration } from "./whatsapp";

describe("writeWhatsAppConfigMigration", () => {
  let root: string;
  const options = () => ({ root }) as Options;
  const migrations = () => fs.readdirSync(path.join(root, "migrations")).sort();

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "whatsapp-config-"));
    fs.mkdirSync(path.join(root, "migrations"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("writes one migration however many times it runs", () => {
    expect(writeWhatsAppConfigMigration(options(), true)).toMatch(
      /_enabled_whatsapp_users\.js$/,
    );
    expect(writeWhatsAppConfigMigration(options(), true)).toBeNull();
    expect(migrations()).toHaveLength(1);
  });

  it("writes another one when the state flips", () => {
    fs.writeFileSync(
      path.join(root, "migrations", "1700000000_enabled_whatsapp_users.js"),
      "",
    );
    expect(writeWhatsAppConfigMigration(options(), false)).toMatch(
      /_disabled_whatsapp_users\.js$/,
    );
    expect(writeWhatsAppConfigMigration(options(), false)).toBeNull();
    expect(migrations()).toHaveLength(2);
  });
});
