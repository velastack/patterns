import fs from "node:fs";
import dedent from "dedent";
import { Project, SyntaxKind } from "ts-morph";
import type { ModifyOutcome } from "../../../../core/types";

const FAILURE_HINT = dedent`
  Switch the SvelteKit adapter to @sveltejs/adapter-auto in svelte.config.js:

  import adapter from '@sveltejs/adapter-auto';

  export default {
    kit: {
      adapter: adapter()
    }
  };
`;

const NOT_FOUND_HINT = dedent`
  Create svelte.config.js using @sveltejs/adapter-auto.
`;

export function modifySvelteConfig(svelteConfigPath: string): ModifyOutcome {
  if (!fs.existsSync(svelteConfigPath)) {
    return { status: "not-found", message: NOT_FOUND_HINT };
  }

  const originalSource = fs.readFileSync(svelteConfigPath, "utf8");
  const project = new Project({ useInMemoryFileSystem: false });
  const sourceFile = project.addSourceFileAtPath(svelteConfigPath);

  const adapterImport = sourceFile
    .getImportDeclarations()
    .find(
      (decl) =>
        decl.getModuleSpecifierValue() === "@sveltejs/adapter-static" ||
        decl.getModuleSpecifierValue() === "@sveltejs/adapter-auto",
    );

  if (!adapterImport) {
    return { status: "failed", message: FAILURE_HINT };
  }

  if (adapterImport.getModuleSpecifierValue() === "@sveltejs/adapter-static") {
    adapterImport.setModuleSpecifier("@sveltejs/adapter-auto");
  }

  const adapterCalls = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((ce) => ce.getExpression().getText() === "adapter");

  for (const call of adapterCalls) {
    const args = call.getArguments();
    for (let i = args.length - 1; i >= 0; i--) {
      call.removeArgument(i);
    }
  }

  sourceFile.formatText();
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}

export function unmodifySvelteConfig(svelteConfigPath: string): ModifyOutcome {
  if (!fs.existsSync(svelteConfigPath)) {
    return { status: "success", changed: false };
  }

  const originalSource = fs.readFileSync(svelteConfigPath, "utf8");
  const project = new Project({ useInMemoryFileSystem: false });
  const sourceFile = project.addSourceFileAtPath(svelteConfigPath);

  const adapterImport = sourceFile
    .getImportDeclarations()
    .find(
      (decl) =>
        decl.getModuleSpecifierValue() === "@sveltejs/adapter-auto" ||
        decl.getModuleSpecifierValue() === "@sveltejs/adapter-static",
    );

  if (!adapterImport) {
    return { status: "success", changed: false };
  }

  if (adapterImport.getModuleSpecifierValue() === "@sveltejs/adapter-auto") {
    adapterImport.setModuleSpecifier("@sveltejs/adapter-static");
  }

  const adapterCalls = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((ce) => ce.getExpression().getText() === "adapter");

  for (const call of adapterCalls) {
    const args = call.getArguments();
    if (args.length === 0) {
      call.addArgument(`{ fallback: '200.html' }`);
    }
  }

  sourceFile.formatText();
  sourceFile.saveSync();

  return {
    status: "success",
    changed: sourceFile.getFullText() !== originalSource,
  };
}
