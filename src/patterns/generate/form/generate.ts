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
import {
  NATIVE_STYLE,
  geoPointState,
  plainRenderer,
  superformsBinding,
  usesConstraints,
} from "../../../core/field/plain";
import { resolveUi } from "../../../core/field/ui";
import { SUPERFORMS, ZOD } from "../../../core/constants";
import { parseRoute, type Field, type Model } from "../../../parse";
import { generateFormServerTestSnippet } from "../../../core/tests";
import {
  generateSchemaSnippet,
  relationLoadLines,
  relationLoadReturnVars,
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

/**
 * The relation field renderers read the related records from
 * `data.<pluralName>`, so `load` has to fetch them.
 */
function relationLoad(fields: Field[], pb: string) {
  const vars = relationLoadReturnVars(fields);
  return {
    args: vars ? "{ locals }" : "",
    lines: relationLoadLines(fields, pb),
    returns: vars ? `, ${vars}` : "",
  };
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

/**
 * The same page without shadcn-svelte, formsnap or tailwind: native elements
 * bound to the superforms stores. Without flash messages the action's
 * `message()` is shown inline.
 */
function plainPageSnippet(
  model: Model,
  fields: Field[],
  injectables: Injectables,
  flash: boolean,
): string {
  const renderer = plainRenderer(superformsBinding(), NATIVE_STYLE);
  const fieldSnippet = fields.map((field) => renderer.render(field)).join("\n");
  const hiddenInputs = injectableHiddenInputs(injectables);
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";
  const stores = [
    "form: formData",
    "errors",
    ...(usesConstraints(fields) ? ["constraints"] : []),
    ...(flash ? [] : ["message"]),
    "enhance",
  ].join(", ");
  const status = flash
    ? ""
    : dedent`
      {#if $message}
        <p role="status">{$message}</p>
      {/if}
    `;

  return dedent`
    <script lang="ts">
      import { untrack } from "svelte";
      import { superForm } from "sveltekit-superforms";
      import { zod4Client } from "sveltekit-superforms/adapters";
      import { ${model.schemaName} } from "$lib/schemas/${model.name}";

      let { data } = $props();

      const { ${stores} } = superForm(untrack(() => data.form), {
        validators: zod4Client(${model.schemaName}),
      });

      ${geoPointState(fields)}
    </script>

    <h1>${model.displayName}</h1>

    ${status}

    <form method="POST"${enctype} use:enhance>
      ${fieldSnippet}
      ${hiddenInputs}
      <button type="submit">Submit</button>
    </form>
  `;
}

function genericServerSnippet(
  model: Model,
  fields: Field[],
  pb: string,
  flash: boolean,
): string {
  const withFiles = hasFiles(fields) && flash;
  const relations = relationLoad(fields, pb);
  const imports = dedent`
    import { fail, ${flash ? "" : "message, "}superValidate${withFiles ? ", withFiles" : ""} } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";
    ${flash ? 'import { setFlash } from "sveltekit-flash-message/server";' : ""}
  `;
  // `message()` strips files from the returned form itself.
  const success = flash
    ? dedent`
      setFlash({ type: "toast", message: "Form posted successfully" }, cookies);

      return ${withFiles ? "withFiles({ form })" : "{ form }"};
    `
    : 'return message(form, "Form posted successfully");';

  return dedent`
    ${imports}

    export const load = async (${relations.args}) => {
      ${relations.lines}
      const form = await superValidate(zod4(${model.schemaName}));
      return { form${relations.returns} };
    };

    export const actions = {
      default: async ({ request${flash ? ", cookies" : ""} }) => {
        const form = await superValidate(request, zod4(${model.schemaName}));

        if (!form.valid) {
          return fail(400, { form });
        }

        ${success}
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
  flash: boolean,
): string {
  const withFiles = hasFiles(fields);
  const relations = relationLoad(fields, pb);
  const success = flash
    ? dedent`
      setFlash({ type: "toast", message: "${model.displayName} created" }, cookies);

      return ${withFiles ? "withFiles({ form })" : "{ form }"};
    `
    : `return message(form, "${model.displayName} created");`;
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
          ...form.data,
          ${injections.join(",\n  ")}
        }
      `
      : "form.data";

  return dedent`
    import { fail } from "@sveltejs/kit";
    import { ${flash ? "" : "message, "}superValidate${withFiles ? ", withFiles" : ""} } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { setPocketbaseErrors } from "@velastack/pocketbase/form";
    ${flash ? 'import { setFlash } from "sveltekit-flash-message/server";' : ""}
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const load = async (${relations.args}) => {
      ${relations.lines}
      return { form: await superValidate(zod4(${model.schemaName}))${relations.returns} };
    };

    export const actions = {
      default: async ({ locals, request${flash ? ", cookies" : ""} }) => {
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

        ${success}
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
  const ui = resolveUi(options);
  const flash = options.input.flash ?? true;
  const serverTests = options.input.serverTests ?? true;

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
        flash,
      )
    : genericServerSnippet(model, uiFields, pbInstance(options), flash);

  const creates = [
    toFile(
      `${route.fileBase}/+page.svelte`,
      ui === "plain"
        ? plainPageSnippet(model, uiFields, injectables, flash)
        : pageSnippet(model, uiFields, injectables),
    ),
    toFile(`${route.fileBase}/+page.server.ts`, serverContent),
    ...(serverTests
      ? [
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
    ui === "plain" ? [] : (getFieldComponents(uiFields) as Component[]);

  return {
    creates,
    modifies: [],
    deletes: [],
    components,
    packages: [SUPERFORMS, ZOD],
    collections: [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
