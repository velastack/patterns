import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { InvalidArgumentError, RegistryUnavailableError } from "../core/errors";
import type { ExecuteCommand } from "../core/types";
import { offlineFetch, registryFetch } from "./registry.mock";
import { loadPreset } from "./shadcn-preset";
import { makePresetProject } from "./shadcn-preset.test";
import { applyBaseColor, applyTheme, listComponents, switchStyle } from "./ui";

const REPO_ROOT = process.cwd();

function uiDir(root: string, ...rest: string[]) {
  return path.join(root, "src", "lib", "components", "ui", ...rest);
}

/** A vega project with a few registry components, a vela component and the template's navbar. */
function makeProject(
  config: Record<string, unknown> = {
    style: "vega",
    tailwind: { css: "src/app.css", baseColor: "neutral" },
    aliases: { ui: "$lib/components/ui" },
    iconLibrary: "lucide",
  },
) {
  const root = makePresetProject(config);
  for (const component of [
    "sonner",
    "button",
    "card",
    "data-table",
    "navbar",
  ]) {
    mkdirSync(uiDir(root, component), { recursive: true });
    writeFileSync(uiDir(root, component, "index.ts"), "export {};\n", "utf8");
  }
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(
    path.join(root, "src", "app.css"),
    "@import 'tailwindcss';\n",
    "utf8",
  );
  return root;
}

const INDEX = [
  "button",
  "card",
  "sonner",
  "badge",
  { name: "dashboard-01", type: "registry:block" },
  { name: "font-geist", type: "registry:font" },
];

function execSpy(onCall?: (args: string[], cwd: string) => void) {
  return vi.fn<ExecuteCommand>(async (cwd, _operation, args) => {
    onCall?.(args, cwd);
  });
}

describe("listComponents", () => {
  it("reports the style, the installed and bundled components, and the registry index", async () => {
    const root = makeProject();
    const result = await listComponents(
      { root },
      { fetch: registryFetch(INDEX) },
    );

    expect(result.style).toBe("vega");
    expect(result.installed).toEqual([
      "button",
      "card",
      "data-table",
      "navbar",
      "sonner",
    ]);
    expect(result.custom).toContain("data-table");
    expect(result.custom).toContain("multiselect");
    expect(result.registry).toHaveLength(INDEX.length);
    expect(result.registry.find((i) => i.name === "dashboard-01")?.type).toBe(
      "registry:block",
    );
    expect(result.registryUnavailable).toBeUndefined();
  });

  it("degrades to the local sections when the registry cannot be read", async () => {
    const root = makeProject();
    const result = await listComponents({ root }, { fetch: offlineFetch() });

    expect(result.installed).toHaveLength(5);
    expect(result.custom.length).toBeGreaterThan(0);
    expect(result.registry).toEqual([]);
    expect(result.registryUnavailable).toMatch(/Could not read .*vega/);
  });

  it("uses shadcn-svelte's default style for a project that names none", async () => {
    const root = makeProject({});
    const calls: string[] = [];
    const result = await listComponents(
      { root },
      { fetch: registryFetch(INDEX, calls) },
    );
    expect(result.style).toBe("nova");
    expect(calls[0]).toContain("/styles/nova/");
  });
});

describe("switchStyle", () => {
  it("re-adds the registry components the new style offers and applies its font", async () => {
    const root = makeProject();
    const calls: string[] = [];
    const executeCommand = execSpy((args) => {
      if (args[1] === "apply") {
        // What `apply --only font` leaves behind.
        writeFileSync(
          path.join(root, "package.json"),
          JSON.stringify({
            name: "tmp",
            devDependencies: { "@fontsource-variable/geist": "^5.0.0" },
          }),
          "utf8",
        );
        writeFileSync(
          path.join(root, "src", "app.css"),
          '@import "tailwindcss";\n@import "@fontsource-variable/inter";\n@import "@fontsource-variable/geist";\n',
          "utf8",
        );
      }
    });
    const confirm = vi.fn(async () => true);
    const messages: string[] = [];

    const result = await switchStyle(
      {
        root,
        style: "nova",
        confirm,
        logger: { info: (m) => messages.push(m) },
      },
      { executeCommand, fetch: registryFetch(INDEX, calls) },
    );

    expect(calls[0]).toBe(
      "https://shadcn-svelte.com/registry/styles/nova/index.json",
    );
    expect(confirm).toHaveBeenCalledWith(["button", "card", "sonner"]);

    expect(executeCommand).toHaveBeenCalledTimes(2);
    expect(executeCommand).toHaveBeenNthCalledWith(1, root, "execute", [
      "shadcn-svelte",
      "add",
      "--yes",
      "--overwrite",
      "button",
      "card",
      "sonner",
    ]);
    const [, , applyArgs] = executeCommand.mock.calls[1]!;
    expect(applyArgs.slice(0, 3)).toEqual([
      "shadcn-svelte",
      "apply",
      "--preset",
    ]);
    expect(applyArgs.slice(4)).toEqual(["--only", "font", "--yes"]);
    const preset = await loadPreset(REPO_ROOT);
    expect(preset.decodePreset(applyArgs[3]!)).toMatchObject({
      style: "nova",
      baseColor: "neutral",
      iconLibrary: "lucide",
      font: "geist",
    });

    // `style` changed, nothing else did, and the tabs survived.
    const config = readFileSync(path.join(root, "components.json"), "utf8");
    expect(config).toContain('\n\t"style": "nova"');
    expect(JSON.parse(config)).toMatchObject({
      style: "nova",
      tailwind: { css: "src/app.css", baseColor: "neutral" },
      iconLibrary: "lucide",
    });

    expect(result).toEqual({
      status: "switched",
      style: "nova",
      reinstalled: ["button", "card", "sonner"],
      filesModified: ["components.json", "src/app.css", "package.json"],
      packages: ["@fontsource-variable/geist"],
      hints: [
        "src/app.css still imports @fontsource-variable/inter from the previous style; remove the import and the package if nothing else uses them.",
      ],
    });
    expect(messages).toContainEqual(expect.stringContaining("nova font"));
  });

  it("leaves fonts alone with font: false", async () => {
    const root = makeProject();
    const executeCommand = execSpy();

    const result = await switchStyle(
      { root, style: "lyra", font: false },
      { executeCommand, fetch: registryFetch(INDEX) },
    );

    expect(executeCommand).toHaveBeenCalledTimes(1);
    expect(executeCommand.mock.calls[0]![2][1]).toBe("add");
    expect(result.filesModified).toEqual(["components.json"]);
    expect(result.packages).toEqual([]);
    expect(result.hints).toEqual([]);
  });

  it("does nothing when the project already has the style", async () => {
    const root = makeProject();
    const executeCommand = execSpy();
    const result = await switchStyle(
      { root, style: "vega" },
      { executeCommand, fetch: offlineFetch() },
    );
    expect(result).toMatchObject({ status: "unchanged", style: "vega" });
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("writes nothing when confirm says no", async () => {
    const root = makeProject();
    const executeCommand = execSpy();
    const before = readFileSync(path.join(root, "components.json"), "utf8");

    const result = await switchStyle(
      { root, style: "nova", confirm: () => false },
      { executeCommand, fetch: registryFetch(INDEX) },
    );

    expect(result.status).toBe("cancelled");
    expect(executeCommand).not.toHaveBeenCalled();
    expect(readFileSync(path.join(root, "components.json"), "utf8")).toBe(
      before,
    );
  });

  it("refuses an unknown style and an unreachable registry before touching anything", async () => {
    const root = makeProject();
    const executeCommand = execSpy();

    await expect(
      switchStyle({ root, style: "solar" }, { executeCommand }),
    ).rejects.toThrow(InvalidArgumentError);
    await expect(
      switchStyle(
        { root, style: "nova" },
        { executeCommand, fetch: offlineFetch() },
      ),
    ).rejects.toBeInstanceOf(RegistryUnavailableError);

    expect(executeCommand).not.toHaveBeenCalled();
    expect(
      JSON.parse(readFileSync(path.join(root, "components.json"), "utf8"))
        .style,
    ).toBe("vega");
  });

  it("switches a project with no registry components by config alone", async () => {
    const root = makePresetProject({ style: "vega" });
    const executeCommand = execSpy();
    const confirm = vi.fn(async () => true);

    const result = await switchStyle(
      { root, style: "rhea", font: false, confirm },
      { executeCommand, fetch: registryFetch(INDEX) },
    );

    expect(confirm).toHaveBeenCalledWith([]);
    expect(executeCommand).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "switched", reinstalled: [] });
  });
});

describe("applyBaseColor", () => {
  it("applies the theme part of a preset with the base color and accent set to the color", async () => {
    const root = makeProject();
    const executeCommand = execSpy((args) => {
      // `apply` records the base color itself.
      const configPath = path.join(root, "components.json");
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      config.tailwind.baseColor = "zinc";
      writeFileSync(configPath, JSON.stringify(config), "utf8");
    });

    const result = await applyBaseColor(
      { root, color: "zinc" },
      { executeCommand },
    );

    expect(executeCommand).toHaveBeenCalledTimes(1);
    const [, , args] = executeCommand.mock.calls[0]!;
    expect(args.slice(4)).toEqual(["--only", "theme", "--yes"]);
    const preset = await loadPreset(REPO_ROOT);
    expect(preset.decodePreset(args[3]!)).toMatchObject({
      style: "vega",
      baseColor: "zinc",
      theme: "zinc",
      chartColor: "zinc",
      iconLibrary: "lucide",
    });
    expect(result).toEqual({
      baseColor: "zinc",
      theme: "zinc",
      filesModified: ["src/app.css", "components.json"],
    });
  });

  it("rejects a color shadcn-svelte does not offer", async () => {
    const root = makeProject();
    const executeCommand = execSpy();
    await expect(
      applyBaseColor({ root, color: "slate" }, { executeCommand }),
    ).rejects.toThrow(/Unknown base color "slate"\. Choose one of: neutral, /);
    expect(executeCommand).not.toHaveBeenCalled();
  });
});

describe("applyTheme", () => {
  it("keeps the base color and sets the accent", async () => {
    const root = makeProject();
    const executeCommand = execSpy();

    const result = await applyTheme(
      { root, theme: "blue" },
      { executeCommand },
    );

    const [, , args] = executeCommand.mock.calls[0]!;
    const preset = await loadPreset(REPO_ROOT);
    expect(preset.decodePreset(args[3]!)).toMatchObject({
      style: "vega",
      baseColor: "neutral",
      theme: "blue",
      chartColor: "blue",
    });
    expect(result).toEqual({
      baseColor: "neutral",
      theme: "blue",
      filesModified: ["src/app.css", "components.json"],
    });
  });

  it("rejects an accent shadcn-svelte does not offer", async () => {
    const root = makeProject();
    await expect(
      applyTheme({ root, theme: "magenta" }, { executeCommand: execSpy() }),
    ).rejects.toThrow(InvalidArgumentError);
  });
});
