import dedent from "dedent";
import { SyntaxKind } from "ts-morph";
import {
  resolveConfigTarget,
  saveTarget,
  type ConfigModifyResult,
  type ConfigTarget,
} from "../../../../runtime/config-target";

const FAILURE_HINT = dedent`
  Switch the SvelteKit adapter to @sveltejs/adapter-auto:

  import adapter from '@sveltejs/adapter-auto';

  // ...
  adapter: adapter()
`;

const NOT_FOUND_HINT = dedent`
  Configure @sveltejs/adapter-auto via the sveltekit() plugin in vite.config.ts.
`;

function findAdapterImport(sourceFile: ConfigTarget["sourceFile"]) {
  return sourceFile
    .getImportDeclarations()
    .find(
      (decl) =>
        decl.getModuleSpecifierValue() === "@sveltejs/adapter-static" ||
        decl.getModuleSpecifierValue() === "@sveltejs/adapter-auto",
    );
}

function adapterCalls(sourceFile: ConfigTarget["sourceFile"]) {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((ce) => ce.getExpression().getText() === "adapter");
}

/**
 * Switch the adapter to `@sveltejs/adapter-auto` and drop its arguments, in
 * whichever file holds the adapter import + `adapter()` call (vite.config when
 * the project uses inline config, else svelte.config). Operates on the import
 * and call expression directly, so it never needs the config object.
 */
export function modifySvelteConfig(root: string): ConfigModifyResult {
  const res = resolveConfigTarget(root, {
    notFound: NOT_FOUND_HINT,
    failed: FAILURE_HINT,
  });
  if (res.status !== "resolved") {
    return {
      filePath: res.filePath,
      outcome: { status: res.status, message: res.message },
    };
  }
  const { target } = res;
  const adapterImport = findAdapterImport(target.sourceFile);
  if (!adapterImport) {
    return {
      filePath: target.filePath,
      outcome: { status: "failed", message: FAILURE_HINT },
    };
  }

  if (adapterImport.getModuleSpecifierValue() === "@sveltejs/adapter-static") {
    adapterImport.setModuleSpecifier("@sveltejs/adapter-auto");
  }

  for (const call of adapterCalls(target.sourceFile)) {
    const args = call.getArguments();
    for (let i = args.length - 1; i >= 0; i--) {
      call.removeArgument(i);
    }
  }

  return { filePath: target.filePath, outcome: saveTarget(target) };
}

/**
 * Reverse of {@link modifySvelteConfig}: switch back to
 * `@sveltejs/adapter-static` and restore the `{ fallback: '200.html' }` arg.
 * Lenient — if no config or no adapter import is found, it's a no-op success.
 */
export function unmodifySvelteConfig(root: string): ConfigModifyResult {
  const res = resolveConfigTarget(root, {
    notFound: NOT_FOUND_HINT,
    failed: FAILURE_HINT,
  });
  if (res.status !== "resolved") {
    // Nothing to revert — treat missing/unparseable config as a no-op.
    return {
      filePath: res.filePath,
      outcome: { status: "success", changed: false },
    };
  }
  const { target } = res;
  const adapterImport = findAdapterImport(target.sourceFile);
  if (!adapterImport) {
    return {
      filePath: target.filePath,
      outcome: { status: "success", changed: false },
    };
  }

  if (adapterImport.getModuleSpecifierValue() === "@sveltejs/adapter-auto") {
    adapterImport.setModuleSpecifier("@sveltejs/adapter-static");
  }

  for (const call of adapterCalls(target.sourceFile)) {
    if (call.getArguments().length === 0) {
      call.addArgument("{ fallback: '200.html' }");
    }
  }

  return { filePath: target.filePath, outcome: saveTarget(target) };
}
