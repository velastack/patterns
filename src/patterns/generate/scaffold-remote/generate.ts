import dedent from "dedent";
import type { Component, File, Options, Result } from "../../../core/types";
import { TANSTACK_TABLE_CORE } from "../../../core/constants";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";
import {
  parseRoute,
  scaffoldFilePaths,
  scaffoldUrls,
  type Field,
  type Model,
} from "../../../parse";
import { renderDisplayField, selectFieldLabelMap } from "../../../core/field";
import {
  getRemoteFieldComponents,
  getRemoteFieldImports,
  renderRemoteField,
} from "../../../core/field/remote";
import {
  collectionSpecFromModelFields,
  generateSchemaSnippet,
  relationExpandParam,
  relationLoadLines,
  relationLoadReturnVars,
  resolveInputFields,
  uniqueRelationCollections,
} from "../../../core/shared";
import { listPageSnippet } from "../../../core/scaffold-list";
import { generateScaffoldRemoteServerTestSnippet } from "../../../core/tests";
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

function createFormIdentifier(model: Model): string {
  return `create${model.typeName}Form`;
}

function updateFormIdentifier(model: Model): string {
  return `update${model.typeName}Form`;
}

function hasRelations(fields: Field[]): boolean {
  return uniqueRelationCollections(fields).length > 0;
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

function editHiddenInputs(model: Model, injectables: Injectables): string {
  const fields = [
    injectables.currentUserField,
    injectables.currentTeamField,
  ].filter((field): field is InjectableField => Boolean(field));
  return fields
    .map(
      (field) =>
        `<input type="hidden" name="${field.name}" value={data.${model.name}.${field.name}} />`,
    )
    .join("\n");
}

/**
 * SvelteKit hands every page `params`; it is declared only where a link
 * interpolates a dynamic route segment, since the projects type-check with
 * noUnusedLocals.
 */
function propsLine(dynamicParams: string[], withData = true): string {
  const names = [
    ...(withData ? ["data"] : []),
    ...(dynamicParams.length > 0 ? ["params"] : []),
  ];
  return names.length > 0 ? `let { ${names.join(", ")} } = $props();` : "";
}

function newPageSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  injectables: Injectables,
  dynamicParams: string[],
): string {
  const formVar = createFormIdentifier(model);
  const components = getRemoteFieldComponents(fields);
  const imports = [
    `import { ${formVar} } from "./form.remote";`,
    'import { Button } from "$lib/components/ui/button";',
    'import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";',
    ...getRemoteFieldImports(components),
  ].join("\n");
  const fieldContent = fields
    .map((field) => renderRemoteField(field, { formVar }))
    .join("\n");
  const hiddenInputs = newHiddenInputs(injectables);
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";
  const listHref = urlSvelteAttrValue(urls.list, dynamicParams);

  return dedent`
    <script lang="ts">
      ${imports}
      ${propsLine(dynamicParams, false)}
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
        <form {...${formVar}}${enctype}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${fieldContent}
          </div>
          ${hiddenInputs}
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Button type="submit" size="sm">Save</Button>
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
  const formVar = updateFormIdentifier(model);
  const components = getRemoteFieldComponents(fields);
  const imports = [
    `import { ${formVar} } from "./form.remote";`,
    'import { Button } from "$lib/components/ui/button";',
    'import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";',
    ...getRemoteFieldImports(components),
  ].join("\n");
  const fieldContent = fields
    .map((field) => renderRemoteField(field, { formVar }))
    .join("\n");
  const hiddenInputs = editHiddenInputs(model, injectables);
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

      let { data, params } = $props();
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
        <form {...${formVar}}${enctype}>
          <input type="hidden" name="id" value={data.${model.name}.id} />
          ${hiddenInputs}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${fieldContent}
          </div>
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Button type="submit" size="sm">Save changes</Button>
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

function newServerSnippet(model: Model, fields: Field[], pb: string): string {
  if (!hasRelations(fields)) {
    return "";
  }
  const relationLoads = relationLoadLines(fields, pb);
  const relationVars = relationLoadReturnVars(fields);
  return dedent`
    export const load = async ({ locals }) => {
      ${relationLoads}
      return { ${relationVars} };
    };
  `;
}

function newRemoteSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  fields: Field[],
  pb: string,
  authMode: boolean,
  dynamicParams: string[],
): string {
  const formVar = createFormIdentifier(model);
  const currentUserField = fields.find(
    (field): field is Extract<Field, { type: "relation" }> =>
      field.type === "relation" && field.isCurrentUser,
  );
  const currentTeamField = fields.find(
    (field): field is Extract<Field, { type: "relation" }> =>
      field.type === "relation" && field.isCurrentTeam,
  );
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
    import { redirect } from "@sveltejs/kit";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const ${formVar} = form(${model.schemaName}, async (data) => {
      const { locals${dynamicParams.length > 0 ? ", params" : ""} } = getRequestEvent();
      const ${model.name} = await ${pb}.collection("${model.tableName}").create(
        ${createPayload}
      );
      redirect(303, ${urlJsExprWithSuffix(urls.list, dynamicParams, `/\${${model.name}.id}`)});
    });
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

      ${propsLine(dynamicParams)}
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

function editServerSnippet(model: Model, fields: Field[], pb: string): string {
  const relationLoads = relationLoadLines(fields, pb);
  const relationVars = relationLoadReturnVars(fields);
  const relationReturn = relationVars ? `, ${relationVars}` : "";
  return dedent`
    import { error } from "@sveltejs/kit";

    export const load = async ({ locals, params }) => {
      let ${model.name};
      try {
        ${model.name} = await ${pb}.collection("${model.tableName}").getOne(params.id);
      } catch {
        throw error(404, "Not found");
      }
      ${relationLoads}
      return { ${model.name}${relationReturn} };
    };
  `;
}

function editRemoteSnippet(
  model: Model,
  urls: ReturnType<typeof scaffoldUrls>,
  injectables: Injectables,
  pb: string,
  dynamicParams: string[],
): string {
  const formVar = updateFormIdentifier(model);
  const { currentUserField, currentTeamField } = injectables;
  const hasPreservations = Boolean(currentUserField || currentTeamField);
  const preservations: string[] = [];
  if (currentUserField) {
    preservations.push(
      `${currentUserField.name}: existing.${currentUserField.name}`,
    );
  }
  if (currentTeamField) {
    preservations.push(
      `${currentTeamField.name}: existing.${currentTeamField.name}`,
    );
  }
  const updateBody = hasPreservations
    ? dedent`
        const existing = await ${pb}.collection("${model.tableName}").getOne(id);
        await ${pb}.collection("${model.tableName}").update(id, {
          ...rest,
          ${preservations.join(",\n  ")}
        });
      `
    : `await ${pb}.collection("${model.tableName}").update(id, rest);`;

  return dedent`
    import { form, getRequestEvent } from "$app/server";
    import { error, redirect } from "@sveltejs/kit";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const ${formVar} = form(${model.schemaName}, async (data) => {
      const { locals${dynamicParams.length > 0 ? ", params" : ""} } = getRequestEvent();
      const { id, collectionId, ...rest } = data;
      if (!id) error(400, "id is required");
      ${updateBody}
      redirect(303, ${urlJsExprWithSuffix(urls.list, dynamicParams, "/${id}")});
    });
  `;
}

export async function generate(options: Options) {
  const { modelPath, fields: fieldDefs } = parsePatternArgs(options.argv);
  const { model, fields, auth, shouldCreateCollection, collections } =
    await resolveInputFields(options, modelPath, fieldDefs);
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
    toFile(
      `${paths.list}/+page.svelte`,
      listPageSnippet(model, urls, uiFields, dynamicParams),
    ),
  ];

  const newServerContent = newServerSnippet(model, uiFields, pb);
  if (newServerContent) {
    creates.push(toFile(`${paths.new}/+page.server.ts`, newServerContent));
  }
  creates.push(
    toFile(
      `${paths.new}/form.remote.ts`,
      newRemoteSnippet(
        model,
        urls,
        fields,
        pb,
        options.features.auth,
        dynamicParams,
      ),
    ),
    toFile(
      `${paths.new}/+page.svelte`,
      newPageSnippet(model, urls, uiFields, injectables, dynamicParams),
    ),
    toFile(
      `${paths.show}/+page.server.ts`,
      showServerSnippet(model, urls, uiFields, pb, dynamicParams),
    ),
    toFile(
      `${paths.show}/+page.svelte`,
      showPageSnippet(model, urls, uiFields, dynamicParams),
    ),
    toFile(
      `${paths.edit}/+page.server.ts`,
      editServerSnippet(model, uiFields, pb),
    ),
    toFile(
      `${paths.edit}/form.remote.ts`,
      editRemoteSnippet(model, urls, injectables, pb, dynamicParams),
    ),
    toFile(
      `${paths.edit}/+page.svelte`,
      editPageSnippet(model, urls, uiFields, injectables, dynamicParams),
    ),
    toFile(
      `${paths.list}/server.test.ts`,
      generateScaffoldRemoteServerTestSnippet(
        model,
        urls,
        fields,
        options,
        collections,
        dynamicParams,
      ),
    ),
  );

  const components = [
    ...getRemoteFieldComponents(uiFields),
    "button",
    "table",
    "data-table",
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
  ] as Component[];

  return {
    creates,
    modifies: [],
    deletes: [],
    components: [...new Set(components)],
    packages: [TANSTACK_TABLE_CORE],
    collections: shouldCreateCollection
      ? [collectionSpecFromModelFields(model, fields, auth)]
      : [],
    collectionPatches: [],
    collectionDrops: [],
  } satisfies Result;
}
