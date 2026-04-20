import dedent from "dedent";
import type { Component, File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";
import {
  getRemoteFieldComponents,
  getRemoteFieldImports,
  renderRemoteField,
} from "../../../core/field/remote";
import { type Field, type Model } from "../../../parse";
import { generateFormRemoteServerTestSnippet } from "../../../core/tests";
import {
  generateSchemaSnippet,
  resolveInputFields,
} from "../../../core/shared";

function formPaths(modelPath: string, routesDir: string) {
  const normalizedModelPath = modelPath.replace(/^\/+|\/+$/g, "");
  const basePath = `${routesDir}/${normalizedModelPath}`;
  const baseUrl = `/${normalizedModelPath}`;

  return {
    pagePath: basePath,
    pageUrl: baseUrl,
  };
}

function parsePatternArgs(argv: string[]) {
  const [modelPath, ...fields] = argv;
  if (!modelPath) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <model> <fields...>",
    );
  }
  if (fields.length === 0) {
    throw new InvalidArgumentError(
      "At least one field definition is required.",
    );
  }

  return { modelPath, fieldDefs: fields };
}

function hasFiles(fields: Field[]): boolean {
  return fields.some((field) => field.type === "file");
}

function submitFormIdentifier(model: Model): string {
  return `submit${model.typeName}Form`;
}

function pageImports(fields: Field[], formVar: string): string[] {
  const components = getRemoteFieldComponents(fields);
  const imports = [
    `import { ${formVar} } from "./form.remote";`,
    'import { Button } from "$lib/components/ui/button";',
    ...getRemoteFieldImports(components),
  ];

  return [...new Set(imports)];
}

function pageSnippet(model: Model, fields: Field[], formVar: string): string {
  const imports = pageImports(fields, formVar).join("\n");
  const fieldSnippet = fields
    .map((field) => renderRemoteField(field, { formVar }))
    .join("\n");
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";

  return dedent`
    <script lang="ts">
      ${imports}
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">${model.displayName}</h1>
      </div>
      <div class="bg-card rounded-lg shadow-sm border p-4">
        <form {...${formVar}}${enctype}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${fieldSnippet}
          </div>
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function remoteSnippet(model: Model, formVar: string): string {
  return dedent`
    import { form, getRequestEvent } from "$app/server";
    import { setFlash } from "sveltekit-flash-message/server";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const ${formVar} = form(${model.schemaName}, async (data) => {
      const { cookies } = getRequestEvent();
      setFlash({ type: "toast", message: "Form posted successfully" }, cookies);
      return { success: true };
    });
  `;
}

function toFile(path: string, content: string): File {
  return {
    path,
    language: languageFromPath(path),
    content,
    status: "success",
  };
}

export async function generate(options: Options) {
  const { modelPath, fieldDefs } = parsePatternArgs(options.argv);
  const { model, fields, collections } = await resolveInputFields(
    options,
    modelPath,
    fieldDefs,
  );
  const { pagePath, pageUrl } = formPaths(modelPath, model.routesDir);
  const formVar = submitFormIdentifier(model);

  const creates = [
    toFile(`${pagePath}/+page.svelte`, pageSnippet(model, fields, formVar)),
    toFile(`${pagePath}/form.remote.ts`, remoteSnippet(model, formVar)),
    toFile(
      `${pagePath}/server.test.ts`,
      generateFormRemoteServerTestSnippet(
        model,
        pageUrl,
        fields,
        options,
        collections,
      ),
    ),
    toFile(
      `src/lib/schemas/${model.name}.ts`,
      generateSchemaSnippet(model, fields, {
        includeModelFields: false,
        forForm: true,
      }),
    ),
  ];

  const components = getRemoteFieldComponents(fields) as Component[];
  if (!components.includes("button")) {
    components.push("button");
  }

  return {
    creates,
    modifies: [],
    deletes: [],
    components,
    packages: [],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
