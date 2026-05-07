import dedent from "dedent";
import type { Component, File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";
import {
  getFieldComponents,
  getFieldImports,
  renderField,
  selectFieldLabelMap,
} from "../../../core/field";
import { parseRoute, type Field, type Model } from "../../../parse";
import { generateFormServerTestSnippet } from "../../../core/tests";
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
  const fields = [
    injectables.currentUserField,
    injectables.currentTeamField,
  ].filter((field): field is InjectableField => Boolean(field));
  return fields
    .map(
      (field) =>
        `<input type="hidden" name="${field.name}" bind:value={$formData.${field.name}} />`,
    )
    .join("\n");
}

function pbInstance(
  options: Pick<Options, "features">,
): "locals.pb" | "locals.admin" {
  return options.features.auth ? "locals.pb" : "locals.admin";
}

function pageImports(model: Model, fields: Field[]): string[] {
  const components = getFieldComponents(fields);
  const imports = [
    'import { untrack } from "svelte";',
    'import { superForm } from "sveltekit-superforms";',
    'import { zod4Client } from "sveltekit-superforms/adapters";',
    `import { ${model.schemaName} } from "$lib/schemas/${model.name}";`,
    ...getFieldImports(components),
  ];

  return [...new Set(imports)];
}

function pageScriptSnippet(model: Model, fields: Field[]): string {
  const selectFields = fields.filter(
    (field): field is Extract<Field, { type: "select" }> =>
      field.type === "select",
  );
  const labelMaps = selectFields
    .map((field) => selectFieldLabelMap(field))
    .join("\n\n");

  return dedent`
    ${labelMaps}

    const form = superForm(untrack(() => data.form), {
      validators: zod4Client(${model.schemaName}),
    });

    const { form: formData } = form;
  `;
}

function pageSnippet(
  model: Model,
  fields: Field[],
  injectables: Injectables,
): string {
  const imports = pageImports(model, fields).join("\n");
  const scriptSnippet = pageScriptSnippet(model, fields);
  const fieldSnippet = fields.map((field) => renderField(field)).join("\n");
  const hiddenInputs = injectableHiddenInputs(injectables);
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";

  return dedent`
    <script lang="ts">
      ${imports}

      let { data } = $props();
      ${scriptSnippet}
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">${model.displayName}</h1>
      </div>
      <div class="bg-card rounded-lg shadow-sm border p-4">
        <form method="POST"${enctype}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${fieldSnippet}
          </div>
          ${hiddenInputs}
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Form.Button>Submit</Form.Button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function genericServerSnippet(model: Model, fields: Field[]): string {
  const withFiles = hasFiles(fields);
  const imports = dedent`
    import { fail, superValidate${withFiles ? ", withFiles" : ""} } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";
    import { setFlash } from "sveltekit-flash-message/server";
  `;

  return dedent`
    ${imports}

    export const load = async () => {
      const form = await superValidate(zod4(${model.schemaName}));
      return { form };
    };

    export const actions = {
      default: async ({ request, cookies }) => {
        const form = await superValidate(request, zod4(${model.schemaName}));

        if (!form.valid) {
          return fail(400, { form });
        }

        setFlash({ type: "toast", message: "Form posted successfully" }, cookies);

        return ${withFiles ? "withFiles({ form })" : "{ form }"};
      }
    };
  `;
}

function createServerSnippet(
  model: Model,
  fields: Field[],
  injectables: Injectables,
  pb: string,
  authMode: boolean,
): string {
  const withFiles = hasFiles(fields);
  const { currentUserField, currentTeamField } = injectables;
  const sentinels: string[] = [];
  const injections: string[] = [];
  if (authMode && currentUserField) {
    sentinels.push(`${currentUserField.name}: "current_user"`);
    injections.push(`${currentUserField.name}: locals.pb.authStore.record?.id`);
  }
  if (currentTeamField) {
    sentinels.push(`${currentTeamField.name}: "current_team"`);
    injections.push(`${currentTeamField.name}: locals.team`);
  }
  const validateArg =
    sentinels.length > 0
      ? `{ ${sentinels.join(", ")} }, zod4(${model.schemaName})`
      : `zod4(${model.schemaName})`;
  const createPayload =
    injections.length > 0
      ? dedent`
        {
          ...form.data,
          ${injections.join(",\n  ")}
        }
      `
      : "form.data";

  return dedent`
    import { fail } from "@sveltejs/kit";
    import { superValidate${withFiles ? ", withFiles" : ""} } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { setPocketbaseErrors } from "@velastack/pocketbase";
    import { setFlash } from "sveltekit-flash-message/server";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const load = async ({ locals }) => {
      return { form: await superValidate(${validateArg}) };
    };

    export const actions = {
      default: async ({ locals, request, cookies }) => {
        const form = await superValidate(request, zod4(${model.schemaName}));

        if (!form.valid) {
          return fail(400, ${withFiles ? "withFiles({ form })" : "{ form }"});
        }

        try {
          await ${pb}.collection("${model.tableName}").create(
            ${createPayload}
          );
        } catch (error) {
          setPocketbaseErrors(form, error);
          return fail(400, ${withFiles ? "withFiles({ form })" : "{ form }"});
        }

        setFlash({ type: "toast", message: "${model.displayName} created" }, cookies);

        return ${withFiles ? "withFiles({ form })" : "{ form }"};
      }
    };
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

  // When fields were derived from an existing collection (no fieldDefs given),
  // generate a server action that creates a record in that collection. When
  // fields were explicitly provided, keep generic-form behavior (validate +
  // flash, no DB write) — the user has signaled custom field shape.
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

  const serverContent = createMode
    ? createServerSnippet(
        model,
        uiFields,
        injectables,
        pbInstance(options),
        options.features.auth,
      )
    : genericServerSnippet(model, uiFields);

  const creates = [
    toFile(
      `${route.fileBase}/+page.svelte`,
      pageSnippet(model, uiFields, injectables),
    ),
    toFile(`${route.fileBase}/+page.server.ts`, serverContent),
    toFile(
      `${route.fileBase}/server.test.ts`,
      generateFormServerTestSnippet(
        model,
        route.urlBase,
        fields,
        options,
        collections,
        route.dynamicParams,
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

  const components = getFieldComponents(uiFields) as Component[];

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
