import fs from "node:fs";
import dedent from "dedent";
import { SvelteFile } from "../../../../runtime/svelte-file";
import type { ModifyOutcome } from "../../../../core/types";

const THEME_IMPORT = `import '../css/twinkleplop-vsc-dark-plus.css';`;

const NOT_FOUND_HINT = dedent`
  Create src/routes/+layout.svelte and import the twinkleplop theme for
  code block highlighting in blog posts:

  <script lang="ts">
    import '../app.css';
    ${THEME_IMPORT}
  </script>
`;

const FAILURE_HINT = dedent`
  Import the twinkleplop theme in your root +layout.svelte for blog code
  block highlighting:

  ${THEME_IMPORT}
`;

export function modifyRootLayoutSvelte(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const file = SvelteFile.fromPath(layoutPath);
  const script = file.getScript();
  if (!script) {
    return { status: "failed", message: FAILURE_HINT };
  }

  if (script.content.includes("twinkleplop-vsc-dark-plus.css")) {
    return { status: "success", changed: false };
  }

  file.modifyScript((source) => {
    const appCssMatch = source.match(
      /^(\s*)import\s+['"][^'"]*app\.css['"];?\s*$/m,
    );
    if (appCssMatch) {
      const indent = appCssMatch[1] ?? "";
      const insertion = `\n${indent}${THEME_IMPORT}`;
      const end = (appCssMatch.index ?? 0) + appCssMatch[0].length;
      return source.slice(0, end) + insertion + source.slice(end);
    }
    return source.replace(/^/, `\n\t${THEME_IMPORT}\n`);
  });

  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
