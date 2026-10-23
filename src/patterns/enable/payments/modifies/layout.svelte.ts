import fs from "node:fs";
import dedent from "dedent";
import type { ModifyOutcome } from "../../../../core/types";
import { SvelteFile } from "../../../../runtime/svelte-file";
import { libModule } from "../../../../runtime/lib-specifier";
import {
  ensureBlankLineAfterImports,
  ensureImports,
  ensurePropsBinding,
  removeImportByModuleSpecifier,
  removePropsBindingIfUnused,
  withInMemoryScript,
} from "../../../../runtime/ts-morph-helpers";

const STATEMENT = "currency.hydrate(data.currency, data.rates);";

const FAILURE_HINT = dedent`
  Start the currency store from the layout's data in src/routes/+layout.svelte:

  <script lang="ts">
  	import { currency } from '#lib/currency.svelte.js';

  	let { data, children } = $props();
  	currency.hydrate(data.currency, data.rates);
  </script>
`;

/**
 * The root `+layout.svelte` hands the store what the server resolved, before
 * any child renders: the first render already shows the visitor's currency,
 * on the server and in the browser alike.
 */
export function modifyLayoutSvelteCurrency(layoutPath: string): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "not-found", message: FAILURE_HINT };
  }
  const file = SvelteFile.fromPath(layoutPath);
  if (file.toString().includes("currency.hydrate(")) {
    return { status: "success", changed: false };
  }
  if (!file.getScript()) return { status: "failed", message: FAILURE_HINT };

  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      ensureImports(sf, [
        {
          namedImports: ["currency"],
          moduleSpecifier: "#lib/currency.svelte.js",
        },
      ]);
      ensurePropsBinding(sf, "data");
      // Right after the props, which it reads.
      const props = sf
        .getVariableStatements()
        .find((statement) => statement.getText().includes("$props()"));
      if (props) {
        sf.insertStatements(props.getChildIndex() + 1, STATEMENT);
      } else {
        sf.addStatements(STATEMENT);
      }
    });
    return out;
  });
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}

/** Take the hydration back out, and the import and `data` prop if nothing else reads them. */
export function unmodifyLayoutSvelteCurrency(
  layoutPath: string,
): ModifyOutcome {
  if (!fs.existsSync(layoutPath)) {
    return { status: "success", changed: false };
  }
  const original = fs.readFileSync(layoutPath, "utf8");
  if (!original.includes("currency.hydrate(")) {
    return { status: "success", changed: false };
  }
  const file = SvelteFile.fromPath(layoutPath);
  const markup = file.toString().replace(/<script[\s\S]*?<\/script>/g, "");
  file.modifyScript((source) => {
    const { source: out } = withInMemoryScript(source, (sf) => {
      for (const statement of sf.getStatements()) {
        if (statement.getText().includes("currency.hydrate("))
          statement.remove();
      }
      removeImportByModuleSpecifier(sf, libModule("currency.svelte.js"));
      removePropsBindingIfUnused(sf, "data", markup);
      ensureBlankLineAfterImports(sf);
    });
    return out;
  });
  file.writeTo(layoutPath);
  return { status: "success", changed: file.hasChanged() };
}
