import dedent from "dedent";
import type { Component, File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";
import {
  getRemoteFieldComponents,
  getRemoteFieldImports,
  renderRemoteField,
} from "../../../core/field/remote";
import { resolveUi } from "../../../core/field/ui";
import { ZOD } from "../../../core/constants";
import { parseRoute, type Field, type Model } from "../../../parse";
import { generateFormRemoteServerTestSnippet } from "../../../core/tests";
import {
  generateSchemaSnippet,
  resolveInputFields,
} from "../../../core/shared";

function parsePatternArgs(argv: string[]) {
  const [modelPath, ...fields] = argv;
  if (!modelPath) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <model> [fields...]",
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

type InjectableField = Extract<Field, { type: "relation" }>;

interface Injectables {
  currentUserField?: InjectableField;
  currentTeamField?: InjectableField;
}

function findInjectables(fields: Field[]): Injectables {
  return {
    currentUserField: fields.find(
      (field): field is InjectableField =>
        field.type === "relation" && field.isCurrentUser,
    ),
    currentTeamField: fields.find(
      (field): field is InjectableField =>
        field.type === "relation" && field.isCurrentTeam,
    ),
  };
}

function injectableHiddenInputs(injectables: Injectables): string {
  const sentinels: Array<[InjectableField, string]> = [];
  if (injectables.currentUserField) {
    sentinels.push([injectables.currentUserField, "current_user"]);
  }
  if (injectables.currentTeamField) {
    sentinels.push([injectables.currentTeamField, "current_team"]);
  }
  return sentinels
    .map(
      ([field, value]) =>
        `<input type="hidden" name="${field.name}" value="${value}" />`,
    )
    .join("\n");
}

function pbInstance(
  options: Pick<Options, "features">,
): "locals.pb" | "locals.admin" {
  return options.features.auth ? "locals.pb" : "locals.admin";
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

function pageSnippet(
  model: Model,
  fields: Field[],
  formVar: string,
  injectables: Injectables,
): string {
  const imports = pageImports(fields, formVar).join("\n");
  const fieldSnippet = fields
    .map((field) => renderRemoteField(field, { formVar }))
    .join("\n");
  const hiddenInputs = injectableHiddenInputs(injectables);
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
          ${hiddenInputs}
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </div>
    </section>
  `;
}

/** The same page with native elements only; see `NATIVE_STYLE`. */
function plainPageSnippet(
  model: Model,
  fields: Field[],
  formVar: string,
  injectables: Injectables,
  flash: boolean,
): string {
  const fieldSnippet = fields
    .map((field) => renderRemoteField(field, { formVar, native: true }))
    .join("\n");
  const hiddenInputs = injectableHiddenInputs(injectables);
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";
  const status = flash
    ? ""
    : dedent`
      {#if ${formVar}.result?.success}
        <p role="status">Form posted successfully</p>
      {/if}
    `;

  return dedent`
    <script lang="ts">
      import { ${formVar} } from "./form.remote";
    </script>

    <h1>${model.displayName}</h1>

    ${status}

    <form {...${formVar}}${enctype}>
      ${fieldSnippet}
      ${hiddenInputs}
      <button type="submit">Submit</button>
    </form>
  `;
}

function genericRemoteSnippet(
  model: Model,
  formVar: string,
  flash: boolean,
): string {
  if (!flash) {
    return dedent`
      import { form } from "$app/server";
      import { ${model.schemaName} } from "$lib/schemas/${model.name}";

      export const ${formVar} = form(${model.schemaName}, async () => {
        return { success: true };
      });
    `;
  }

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

function createRemoteSnippet(
  model: Model,
  formVar: string,
  injectables: Injectables,
  pb: string,
  authMode: boolean,
  flash: boolean,
): string {
  const { currentUserField, currentTeamField } = injectables;
  const injections: string[] = [];
  if (authMode && currentUserField) {
    injections.push(`${currentUserField.name}: locals.pb.authStore.record?.id`);
  }
  if (currentTeamField) {
    injections.push(`${currentTeamField.name}: locals.team`);
  }
  const createPayload =
    injections.length > 0
      ? dedent`
        {
          ...data,
          ${injections.join(",\n  ")}
        }
      `
      : "data";

  return dedent`
    import { form, getRequestEvent } from "$app/server";
    ${flash ? 'import { setFlash } from "sveltekit-flash-message/server";' : ""}
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const ${formVar} = form(${model.schemaName}, async (data) => {
      const { locals${flash ? ", cookies" : ""} } = getRequestEvent();
      await ${pb}.collection("${model.tableName}").create(
        ${createPayload}
      );
      ${flash ? `setFlash({ type: "toast", message: "${model.displayName} created" }, cookies);` : ""}
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
  const { model, fields, shouldCreateCollection, collections } =
    await resolveInputFields(options, modelPath, fieldDefs);
  const route = parseRoute(options.input.route, model, options, "form");
  const formVar = submitFormIdentifier(model);
  const ui = resolveUi(options.input);
  const flash = options.input.flash ?? true;
  const serverTests = options.input.serverTests ?? true;

  // When fields were derived from an existing collection (no fieldDefs given),
  // generate a remote form that creates a record. When fields were explicitly
  // provided, keep generic-form behavior (validate + flash, no DB write).
  const createMode = !shouldCreateCollection;
  const injectables = createMode ? findInjectables(fields) : {};
  const uiFields = createMode
    ? fields.filter(
        (field) =>
          !(
            field.type === "relation" &&
            (field.isCurrentUser || field.isCurrentTeam)
          ),
      )
    : fields;

  const remoteContent = createMode
    ? createRemoteSnippet(
        model,
        formVar,
        injectables,
        pbInstance(options),
        options.features.auth,
        flash,
      )
    : genericRemoteSnippet(model, formVar, flash);

  const creates = [
    toFile(
      `${route.fileBase}/+page.svelte`,
      ui === "plain"
        ? plainPageSnippet(model, uiFields, formVar, injectables, flash)
        : pageSnippet(model, uiFields, formVar, injectables),
    ),
    toFile(`${route.fileBase}/form.remote.ts`, remoteContent),
    ...(serverTests
      ? [
          toFile(
            `${route.fileBase}/server.test.ts`,
            generateFormRemoteServerTestSnippet(
              model,
              route.urlBase,
              fields,
              options,
              collections,
              route.dynamicParams,
            ),
          ),
        ]
      : []),
    toFile(
      `src/lib/schemas/${model.name}.ts`,
      generateSchemaSnippet(model, fields, {
        includeModelFields: false,
        forForm: true,
      }),
    ),
  ];

  // Plain markup needs nothing from the shadcn-svelte registry.
  const components =
    ui === "plain" ? [] : (getRemoteFieldComponents(uiFields) as Component[]);
  if (ui !== "plain" && !components.includes("button")) {
    components.push("button");
  }

  return {
    creates,
    modifies: [],
    deletes: [],
    components,
    packages: [ZOD],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
