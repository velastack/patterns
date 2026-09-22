import dedent from "dedent";
import type { Component, File, Options, Result } from "../../../core/types";
import { SUPERFORMS, TANSTACK_TABLE_CORE, ZOD } from "../../../core/constants";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";
import {
  parseRoute,
  scaffoldFilePaths,
  scaffoldUrls,
  type Field,
  type Model,
} from "../../../parse";
import {
  getFieldComponents,
  getFieldImports,
  renderDisplayField,
  renderField,
  selectFieldLabelMap,
} from "../../../core/field";
import {
  collectionSpecFromModelFields,
  generateSchemaSnippet,
  relationExpandParam,
  relationLoadLines,
  relationLoadReturnVars,
  resolveInputFields,
} from "../../../core/shared";
import {
  NATIVE_STYLE,
  geoPointState,
  plainRenderer,
  superformsBinding,
  usesConstraints,
} from "../../../core/field/plain";
import { renderPlainValue } from "../../../core/field/plain-display";
import { resolveUi } from "../../../core/field/ui";
import {
  listPageSnippet,
  plainListPageSnippet,
} from "../../../core/scaffold-list";
import { generateScaffoldServerTestSnippet } from "../../../core/tests";
import {
  urlJsExpr,
  urlJsExprWithSuffix,
  urlSvelteAttrValue,
} from "../../../core/url";

function parsePatternArgs(argv: string[]) {
  const [modelPath, ...fields] = argv;
  if (!modelPath) {
    throw new InvalidArgumentError(
      "Invalid command arguments. Expected: <model> [fields...]",
    );
  }

  return { modelPath, fields };
}

function toFile(path: string, content: string): File {
  return {
    path,
    language: languageFromPath(path),
    content,
    status: "success",
  };
}

function hasFiles(fields: Field[]): boolean {
  return fields.some((field) => field.type === "file");
}

function uniqueImports(imports: string[]): string[] {
  return [...new Set(imports.filter(Boolean))];
}

function selectLabelMaps(fields: Field[]): string {
  return fields
    .filter(
      (field): field is Extract<Field, { type: "select" }> =>
        field.type === "select",
    )
    .map((field) => selectFieldLabelMap(field))
    .join("\n\n");
}

function pbInstance(
  options: Pick<Options, "features">,
): "locals.pb" | "locals.admin" {
  return options.features.auth ? "locals.pb" : "locals.admin";
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

function newHiddenInputs(injectables: Injectables): string {
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

function editHiddenInputs(injectables: Injectables): string {
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

/**
 * SvelteKit hands every page `params`; it is declared only where a link or
 * redirect interpolates a dynamic route segment, since the projects
 * type-check with noUnusedLocals.
 */
function propsLine(withParams: boolean): string {
  return withParams
    ? "let { data, params } = $props();"
    : "let { data } = $props();";
}

function formScript(
  model: Model,
  fields: Field[],
  includeParams = false,
): string {
  const labels = selectLabelMaps(fields);

  return dedent`
    ${labels}
    ${propsLine(includeParams)}

    const form = superForm(untrack(() => data.form), {
      validators: zod4Client(${model.schemaName}),
    });

    const { form: formData } = form;
  `;
}

function newPageSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  injectables: Injectables,
  dynamicParams: string[],
): string {
  const imports = uniqueImports([
    'import { untrack } from "svelte";',
    'import { superForm } from "sveltekit-superforms";',
    'import { zod4Client } from "sveltekit-superforms/adapters";',
    `import { ${model.schemaName} } from "$lib/schemas/${model.name}";`,
    ...getFieldImports(getFieldComponents(fields)),
    'import { Button } from "$lib/components/ui/button";',
    'import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";',
    'import * as Form from "$lib/components/ui/form";',
  ]).join("\n");
  const fieldContent = fields.map((field) => renderField(field)).join("\n");
  const hiddenInputs = newHiddenInputs(injectables);
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";
  const listHref = urlSvelteAttrValue(urls.list, dynamicParams);

  return dedent`
    <script lang="ts">
      ${imports}
      ${formScript(model, fields, dynamicParams.length > 0)}
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">New ${model.displayName.toLowerCase()}</h1>
        <Button href${listHref} variant="outline" size="sm">
          <ArrowLeftIcon class="w-4 h-4" />
          Back to list
        </Button>
      </div>

      <div class="bg-card rounded-lg shadow-sm border p-4">
        <form method="POST"${enctype}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${fieldContent}
          </div>
          ${hiddenInputs}
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Form.Button size="sm">Save</Form.Button>
            <Button href${listHref} variant="outline" size="sm">Cancel</Button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function editPageSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  injectables: Injectables,
  dynamicParams: string[],
): string {
  const imports = uniqueImports([
    'import { untrack } from "svelte";',
    'import { superForm } from "sveltekit-superforms";',
    'import { zod4Client } from "sveltekit-superforms/adapters";',
    `import { ${model.schemaName} } from "$lib/schemas/${model.name}";`,
    ...getFieldImports(getFieldComponents(fields)),
    'import { Button } from "$lib/components/ui/button";',
    'import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";',
    'import * as Form from "$lib/components/ui/form";',
  ]).join("\n");
  const fieldContent = fields.map((field) => renderField(field)).join("\n");
  const hiddenInputs = editHiddenInputs(injectables);
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";
  const listHref = urlSvelteAttrValue(urls.list, dynamicParams);
  const cancelHref = urlSvelteAttrValue(
    urls.list,
    dynamicParams,
    "/{params.id}",
  );
  return dedent`
    <script lang="ts">
      ${imports}
      ${formScript(model, fields, true)}
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">Edit ${model.displayName.toLowerCase()}</h1>
        <Button href${listHref} variant="outline" size="sm">
          <ArrowLeftIcon class="w-4 h-4" />
          Back to list
        </Button>
      </div>

      <div class="bg-card rounded-lg shadow-sm border p-4">
        <form method="POST"${enctype}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${fieldContent}
          </div>
          ${hiddenInputs}
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Form.Button size="sm">Save changes</Form.Button>
            <Button href${cancelHref} variant="outline" size="sm">Cancel</Button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function listServerSnippet(model: Model, fields: Field[], pb: string): string {
  const expand = relationExpandParam(fields);
  const getFullListArgs = expand ? `{ expand: "${expand}" }` : "";

  return dedent`
    export const load = async ({ locals }) => {
      const ${model.pluralName} = await ${pb}.collection("${model.tableName}").getFullList(${getFullListArgs});
      return { ${model.pluralName} };
    };
  `;
}

function newServerSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  injectables: Injectables,
  pb: string,
  authMode: boolean,
  dynamicParams: string[],
): string {
  const withFiles = hasFiles(fields);
  const relationLoads = relationLoadLines(fields, pb);
  const relationVars = relationLoadReturnVars(fields);
  const relationReturn = relationVars ? `, ${relationVars}` : "";
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
    import { fail, redirect } from "@sveltejs/kit";
    import { superValidate${withFiles ? ", withFiles" : ""} } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { setPocketbaseErrors } from "@velastack/pocketbase/form";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const load = async ({ locals }) => {
      ${relationLoads}
      return { form: await superValidate(zod4(${model.schemaName}))${relationReturn} };
    };

    export const actions = {
      default: async ({ locals, request${dynamicParams.length > 0 ? ", params" : ""} }) => {
        const form = await superValidate(request, zod4(${model.schemaName}));

        if (!form.valid) {
          return fail(400, ${withFiles ? "withFiles({ form })" : "{ form }"});
        }

        let ${model.name};

        try {
          ${model.name} = await ${pb}.collection("${model.tableName}").create(
            ${createPayload}
          );
        } catch (error) {
          setPocketbaseErrors(form, error);
          return fail(400, ${withFiles ? "withFiles({ form })" : "{ form }"});
        }

        return redirect(303, ${urlJsExprWithSuffix(urls.list, dynamicParams, `/\${${model.name}.id}`)});
      },
    };
  `;
}

function showServerSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  pb: string,
  dynamicParams: string[],
): string {
  const expand = relationExpandParam(fields);
  const getOneArgs = expand ? `, { expand: "${expand}" }` : "";
  return dedent`
    import { error, redirect } from "@sveltejs/kit";

    export const load = async ({ locals, params }) => {
      try {
        const ${model.name} = await ${pb}.collection("${model.tableName}").getOne(params.id${getOneArgs});
        return { ${model.name} };
      } catch {
        throw error(404, "Not found");
      }
    };

    export const actions = {
      default: async ({ locals, params }) => {
        await ${pb}.collection("${model.tableName}").delete(params.id);
        throw redirect(303, ${urlJsExpr(urls.list, dynamicParams)});
      },
    };
  `;
}

function showPageSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  dynamicParams: string[],
): string {
  const hasSelectFields = fields.some((field) => field.type === "select");
  const hasRelationFields = fields.some((field) => field.type === "relation");
  const hasFileFields = fields.some((field) => field.type === "file");

  const imports = [
    'import { Button } from "$lib/components/ui/button";',
    'import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";',
    hasSelectFields || hasRelationFields
      ? 'import { Badge } from "$lib/components/ui/badge";'
      : "",
    hasRelationFields
      ? 'import CircleArrowRightIcon from "@lucide/svelte/icons/circle-arrow-right";'
      : "",
    hasFileFields ? 'import FileIcon from "@lucide/svelte/icons/file";' : "",
  ]
    .filter(Boolean)
    .join("\n");

  const labels = selectLabelMaps(fields);
  const displays = fields
    .map((field) => renderDisplayField(model, field))
    .join("\n");

  const listHref = urlSvelteAttrValue(urls.list, dynamicParams);
  const editHref = urlSvelteAttrValue(
    urls.list,
    dynamicParams,
    `/{data.${model.name}.id}/edit`,
  );

  return dedent`
    <script lang="ts">
      ${imports}
      ${labels}

      ${propsLine(dynamicParams.length > 0)}
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">${model.displayName} details</h1>
        <Button href${listHref} variant="outline" size="sm">
          <ArrowLeftIcon class="w-4 h-4" />
          Back to list
        </Button>
      </div>

      <div class="bg-card rounded-lg shadow-sm border p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          ${displays}
        </div>

        <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4 justify-between">
          <Button href${editHref} variant="outline" size="sm">
            Edit
          </Button>
          <form method="POST">
            <Button type="submit" variant="destructive" size="sm">Delete</Button>
          </form>
        </div>
      </div>
    </section>
  `;
}

/**
 * The new/edit page without shadcn-svelte, formsnap or tailwind: native
 * elements bound to the superforms stores, as generate-form's plain page.
 */
function plainFormPageSnippet(
  model: Model,
  fields: Field[],
  options: {
    title: string;
    submit: string;
    cancelHref: string;
    hiddenInputs: string;
    withParams: boolean;
  },
): string {
  const renderer = plainRenderer(superformsBinding(), NATIVE_STYLE);
  const fieldContent = fields.map((field) => renderer.render(field)).join("\n");
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";
  const stores = [
    "form: formData",
    "errors",
    ...(usesConstraints(fields) ? ["constraints"] : []),
    "enhance",
  ].join(", ");

  return dedent`
    <script lang="ts">
      import { untrack } from "svelte";
      import { superForm } from "sveltekit-superforms";
      import { zod4Client } from "sveltekit-superforms/adapters";
      import { ${model.schemaName} } from "$lib/schemas/${model.name}";

      ${propsLine(options.withParams)}

      const { ${stores} } = superForm(untrack(() => data.form), {
        validators: zod4Client(${model.schemaName}),
      });

      ${geoPointState(fields)}
    </script>

    <h1>${options.title}</h1>

    <form method="POST"${enctype} use:enhance>
      ${fieldContent}
      ${options.hiddenInputs}
      <button type="submit">${options.submit}</button>
      <a href${options.cancelHref}>Cancel</a>
    </form>
  `;
}

function plainNewPageSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  injectables: Injectables,
  dynamicParams: string[],
): string {
  return plainFormPageSnippet(model, fields, {
    title: `New ${model.displayName.toLowerCase()}`,
    submit: "Save",
    cancelHref: urlSvelteAttrValue(urls.list, dynamicParams),
    hiddenInputs: newHiddenInputs(injectables),
    withParams: dynamicParams.length > 0,
  });
}

function plainEditPageSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  injectables: Injectables,
  dynamicParams: string[],
): string {
  return plainFormPageSnippet(model, fields, {
    title: `Edit ${model.displayName.toLowerCase()}`,
    submit: "Save changes",
    cancelHref: urlSvelteAttrValue(urls.list, dynamicParams, "/{params.id}"),
    hiddenInputs: editHiddenInputs(injectables),
    withParams: true,
  });
}

/** The detail page as a `<dl>`, with the edit link and the delete form. */
function plainShowPageSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  dynamicParams: string[],
): string {
  const record = `data.${model.name}`;
  const details = fields
    .map(
      (field) => dedent`
        <dt>${field.title}</dt>
        <dd>${renderPlainValue(field, record)}</dd>
      `,
    )
    .join("\n");

  return dedent`
    <script lang="ts">
      ${selectLabelMaps(fields)}

      ${propsLine(dynamicParams.length > 0)}
    </script>

    <h1>${model.displayName} details</h1>

    <dl>
      ${details}
    </dl>

    <p><a href${urlSvelteAttrValue(urls.list, dynamicParams, `/{${record}.id}/edit`)}>Edit</a></p>
    <form method="POST">
      <button type="submit">Delete</button>
    </form>
    <p><a href${urlSvelteAttrValue(urls.list, dynamicParams)}>Back to list</a></p>
  `;
}

function editServerSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  injectables: Injectables,
  pb: string,
  dynamicParams: string[],
): string {
  const withFiles = hasFiles(fields);
  const relationLoads = relationLoadLines(fields, pb);
  const relationVars = relationLoadReturnVars(fields);
  const relationReturn = relationVars ? `, ${relationVars}` : "";
  const { currentUserField, currentTeamField } = injectables;
  const preservations: string[] = [];
  if (currentUserField) {
    preservations.push(
      `${currentUserField.name}: ${model.name}.${currentUserField.name}`,
    );
  }
  if (currentTeamField) {
    preservations.push(
      `${currentTeamField.name}: ${model.name}.${currentTeamField.name}`,
    );
  }
  const updatePayload =
    preservations.length > 0
      ? dedent`
        {
          ...form.data,
          ${preservations.join(",\n  ")}
        }
      `
      : "form.data";

  return dedent`
    import { error, fail, redirect } from "@sveltejs/kit";
    import { setPocketbaseErrors, setDefaultData } from "@velastack/pocketbase/form";
    import { superValidate${withFiles ? ", withFiles" : ""} } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const load = async ({ locals, params }) => {
      let ${model.name};
      try {
        ${model.name} = await ${pb}.collection("${model.tableName}").getOne(params.id);
      } catch {
        throw error(404, "Not found");
      }
      ${relationLoads}
      return { form: await superValidate(${model.name}, zod4(${model.schemaName}))${relationReturn} };
    };

    export const actions = {
      default: async ({ locals, params, request }) => {
        const ${model.name} = await ${pb}.collection("${model.tableName}").getOne(params.id);
        const form = await superValidate(request, zod4(${model.schemaName}));

        if (!form.valid) {
          setDefaultData(form, ${model.name});
          return fail(400, ${withFiles ? "withFiles({ form })" : "{ form }"});
        }

        try {
          await ${pb}.collection("${model.tableName}").update(params.id, ${updatePayload});
        } catch (error) {
          setPocketbaseErrors(form, error);
          setDefaultData(form, ${model.name});
          return fail(400, ${withFiles ? "withFiles({ form })" : "{ form }"});
        }

        // Outside the try: redirect() throws, and the catch would swallow it.
        return redirect(303, ${urlJsExprWithSuffix(urls.list, dynamicParams, "/${params.id}")});
      },
    };
  `;
}

export async function generate(options: Options) {
  const { modelPath, fields: fieldDefs } = parsePatternArgs(options.argv);
  const { model, fields, auth, shouldCreateCollection, collections } =
    await resolveInputFields(options, modelPath, fieldDefs);

  if (
    fieldDefs.length > 0 &&
    collections.some((collection) => collection.name === model.tableName)
  ) {
    throw new InvalidArgumentError(
      `Collection "${model.tableName}" already exists. To run scaffold with an existing collection, omit the field definitions.`,
    );
  }

  const route = parseRoute(options.input.route, model, options, "scaffold");
  const paths = scaffoldFilePaths(route);
  const urls = scaffoldUrls(route);
  const dynamicParams = route.dynamicParams;
  const pb = pbInstance(options);
  const uiFields = fields.filter(
    (field) =>
      !(
        field.type === "relation" &&
        (field.isCurrentUser || field.isCurrentTeam)
      ),
  );
  const injectables = findInjectables(fields);
  const ui = resolveUi(options);
  const serverTests = options.input.serverTests ?? true;
  const pages =
    ui === "plain"
      ? {
          list: plainListPageSnippet(model, urls, uiFields, dynamicParams),
          new: plainNewPageSnippet(
            model,
            urls,
            uiFields,
            injectables,
            dynamicParams,
          ),
          show: plainShowPageSnippet(model, urls, uiFields, dynamicParams),
          edit: plainEditPageSnippet(
            model,
            urls,
            uiFields,
            injectables,
            dynamicParams,
          ),
        }
      : {
          list: listPageSnippet(model, urls, uiFields, dynamicParams),
          new: newPageSnippet(
            model,
            urls,
            uiFields,
            injectables,
            dynamicParams,
          ),
          show: showPageSnippet(model, urls, uiFields, dynamicParams),
          edit: editPageSnippet(
            model,
            urls,
            uiFields,
            injectables,
            dynamicParams,
          ),
        };

  const creates: File[] = [
    toFile(
      `src/lib/schemas/${model.name}.ts`,
      generateSchemaSnippet(model, fields, {
        includeModelFields: true,
        forForm: true,
      }),
    ),
    toFile(
      `${paths.list}/+page.server.ts`,
      listServerSnippet(model, uiFields, pb),
    ),
    toFile(`${paths.list}/+page.svelte`, pages.list),
    toFile(
      `${paths.new}/+page.server.ts`,
      newServerSnippet(
        model,
        urls,
        uiFields,
        injectables,
        pb,
        options.features.auth,
        dynamicParams,
      ),
    ),
    toFile(`${paths.new}/+page.svelte`, pages.new),
    toFile(
      `${paths.show}/+page.server.ts`,
      showServerSnippet(model, urls, uiFields, pb, dynamicParams),
    ),
    toFile(`${paths.show}/+page.svelte`, pages.show),
    toFile(
      `${paths.edit}/+page.server.ts`,
      editServerSnippet(model, urls, uiFields, injectables, pb, dynamicParams),
    ),
    toFile(`${paths.edit}/+page.svelte`, pages.edit),
    ...(serverTests
      ? [
          toFile(
            `${paths.list}/server.test.ts`,
            generateScaffoldServerTestSnippet(
              model,
              urls,
              fields,
              options,
              collections,
              dynamicParams,
            ),
          ),
        ]
      : []),
  ];

  // Plain markup needs nothing from the registry, and no TanStack Table.
  const components =
    ui === "plain"
      ? []
      : ([
          ...getFieldComponents(uiFields),
          "button",
          "table",
          "data-table",
          "command",
          "popover",
          "separator",
          "badge",
          "dropdown-menu",
          "checkbox",
          "select",
          "cells",
          "column-header",
          "faceted-filter",
          "pagination",
          "row-actions",
        ] as Component[]);

  return {
    creates,
    modifies: [],
    deletes: [],
    components: [...new Set(components)],
    packages:
      ui === "plain"
        ? [SUPERFORMS, ZOD]
        : [SUPERFORMS, ZOD, TANSTACK_TABLE_CORE],
    collections: shouldCreateCollection
      ? [collectionSpecFromModelFields(model, fields, auth)]
      : [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
