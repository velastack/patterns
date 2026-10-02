import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensurePackageImports,
  ensurePackageOverrides,
  removePackageImports,
} from "./package-imports";

const roots: string[] = [];

afterEach(() => {
  while (roots.length) {
    fs.rmSync(roots.pop()!, { recursive: true, force: true });
  }
});

function makeRoot(packageJson?: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vela-pkg-imports-"));
  roots.push(root);
  if (packageJson !== undefined) {
    fs.writeFileSync(path.join(root, "package.json"), packageJson);
  }
  return root;
}

const read = (root: string) =>
  fs.readFileSync(path.join(root, "package.json"), "utf8");

const LOCALES = { "#locales/*": "./src/locales/*" };

const TABS = [
  "{",
  '\t"name": "app",',
  '\t"type": "module",',
  '\t"imports": {',
  '\t\t"#lib": "./src/lib/index.js",',
  '\t\t"#lib/*": "./src/lib/*"',
  "\t},",
  '\t"scripts": {}',
  "}",
  "",
].join("\n");

describe("ensurePackageImports", () => {
  it("adds to an existing imports map, keeping tabs and the trailing newline", () => {
    const root = makeRoot(TABS);
    const first = ensurePackageImports(root, LOCALES);
    expect(first.outcome).toEqual({ status: "success", changed: true });
    expect(read(root)).toBe(
      TABS.replace(
        '"./src/lib/*"\n',
        '"./src/lib/*",\n\t\t"#locales/*": "./src/locales/*"\n',
      ),
    );

    const after = read(root);
    expect(ensurePackageImports(root, LOCALES).outcome).toEqual({
      status: "success",
      changed: false,
    });
    expect(read(root)).toBe(after);
  });

  it("creates imports after type, with two-space indent and no trailing newline", () => {
    const source =
      '{\n  "name": "app",\n  "type": "module",\n  "scripts": {}\n}';
    const root = makeRoot(source);
    ensurePackageImports(root, { "#lib": "./src/lib/index.js" });
    expect(read(root)).toBe(
      '{\n  "name": "app",\n  "type": "module",\n  "imports": {\n    "#lib": "./src/lib/index.js"\n  },\n  "scripts": {}\n}',
    );
  });

  it("never overwrites a key with a different value", () => {
    const root = makeRoot(
      '{\n\t"imports": {\n\t\t"#locales/*": "./locales/*"\n\t}\n}\n',
    );
    const result = ensurePackageImports(root, {
      ...LOCALES,
      "#lib": "./src/lib/index.js",
    });
    expect(result.outcome.status).toBe("failed");
    expect(
      result.outcome.status === "failed" && result.outcome.message,
    ).toContain('"#locales/*": "./locales/*" (vela uses "./src/locales/*")');
    // The rest still lands.
    expect(JSON.parse(read(root)).imports).toEqual({
      "#locales/*": "./locales/*",
      "#lib": "./src/lib/index.js",
    });
  });

  it("refuses an imports field that is not an object", () => {
    const source = '{\n\t"imports": "nope"\n}\n';
    const root = makeRoot(source);
    expect(ensurePackageImports(root, LOCALES).outcome.status).toBe("failed");
    expect(read(root)).toBe(source);
  });

  it("is not-found without a package.json", () => {
    expect(ensurePackageImports(makeRoot(), LOCALES).outcome.status).toBe(
      "not-found",
    );
  });

  it("keeps CRLF line endings", () => {
    const root = makeRoot('{\r\n  "name": "app"\r\n}\r\n');
    ensurePackageImports(root, LOCALES);
    expect(read(root)).toBe(
      '{\r\n  "name": "app",\r\n  "imports": {\r\n    "#locales/*": "./src/locales/*"\r\n  }\r\n}\r\n',
    );
  });
});

describe("removePackageImports", () => {
  it("removes the keys and drops an imports map left empty", () => {
    const root = makeRoot(TABS);
    ensurePackageImports(root, LOCALES);
    const first = removePackageImports(root, ["#locales/*"], LOCALES);
    expect(first.outcome).toEqual({ status: "success", changed: true });
    expect(read(root)).toBe(TABS);

    expect(removePackageImports(root, ["#locales/*"], LOCALES).outcome).toEqual(
      {
        status: "success",
        changed: false,
      },
    );

    removePackageImports(root, ["#lib", "#lib/*"]);
    expect(read(root)).toBe(
      '{\n\t"name": "app",\n\t"type": "module",\n\t"scripts": {}\n}\n',
    );
  });

  it("keeps a key whose value no longer matches what vela wrote", () => {
    const root = makeRoot(
      '{\n\t"imports": {\n\t\t"#locales/*": "./locales/*"\n\t}\n}\n',
    );
    const result = removePackageImports(root, ["#locales/*"], LOCALES);
    expect(result.outcome).toEqual({ status: "success", changed: false });
    expect(JSON.parse(read(root)).imports).toEqual({
      "#locales/*": "./locales/*",
    });
  });

  it("is a no-op without a package.json or an imports map", () => {
    expect(removePackageImports(makeRoot(), ["#x"]).outcome).toEqual({
      status: "success",
      changed: false,
    });
    const root = makeRoot('{\n\t"name": "app"\n}\n');
    expect(removePackageImports(root, ["#x"]).outcome).toEqual({
      status: "success",
      changed: false,
    });
  });
});

describe("ensurePackageOverrides", () => {
  const FORMSNAP = { formsnap: { "sveltekit-superforms": "3.0.0-next.1" } };

  it("creates overrides at the end, idempotently", () => {
    const root = makeRoot('{\n\t"name": "app",\n\t"devDependencies": {}\n}\n');
    expect(ensurePackageOverrides(root, FORMSNAP).outcome).toEqual({
      status: "success",
      changed: true,
    });
    const after = read(root);
    expect(after).toBe(
      [
        "{",
        '\t"name": "app",',
        '\t"devDependencies": {},',
        '\t"overrides": {',
        '\t\t"formsnap": {',
        '\t\t\t"sveltekit-superforms": "3.0.0-next.1"',
        "\t\t}",
        "\t}",
        "}",
        "",
      ].join("\n"),
    );
    expect(ensurePackageOverrides(root, FORMSNAP).outcome).toEqual({
      status: "success",
      changed: false,
    });
    expect(read(root)).toBe(after);
  });

  it("deep-merges into existing overrides", () => {
    const root = makeRoot(
      JSON.stringify(
        { overrides: { cookie: "1.0.0", formsnap: { "bits-ui": "2.0.0" } } },
        null,
        2,
      ),
    );
    ensurePackageOverrides(root, FORMSNAP);
    expect(JSON.parse(read(root)).overrides).toEqual({
      cookie: "1.0.0",
      formsnap: { "bits-ui": "2.0.0", "sveltekit-superforms": "3.0.0-next.1" },
    });
  });

  it("keeps a bare version as npm's '.' when nesting under it", () => {
    const root = makeRoot(JSON.stringify({ overrides: { formsnap: "2.0.1" } }));
    expect(ensurePackageOverrides(root, FORMSNAP).outcome.status).toBe(
      "success",
    );
    expect(JSON.parse(read(root)).overrides).toEqual({
      formsnap: { ".": "2.0.1", "sveltekit-superforms": "3.0.0-next.1" },
    });
  });

  it("never overwrites a different version", () => {
    const source = JSON.stringify(
      {
        overrides: {
          formsnap: { "sveltekit-superforms": "$sveltekit-superforms" },
        },
      },
      null,
      "\t",
    );
    const root = makeRoot(source);
    const result = ensurePackageOverrides(root, FORMSNAP);
    expect(result.outcome.status).toBe("failed");
    expect(
      result.outcome.status === "failed" && result.outcome.message,
    ).toContain(
      'formsnap > sveltekit-superforms: "$sveltekit-superforms" (vela uses "3.0.0-next.1")',
    );
    expect(read(root)).toBe(source);
  });
});
