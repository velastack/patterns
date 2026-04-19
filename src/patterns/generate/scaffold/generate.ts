import dedent from "dedent";
import type { Component, File, Options, Result } from "../../../core/types";
import { InvalidArgumentError } from "../../../core/errors";
import { languageFromPath } from "../../../core/util";
import { modelPaths, modelUrls, type Field, type Model } from "../../../parse";
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
  resolveInputFields,
  uniqueRelationCollections,
} from "../../../core/shared";
import { generateScaffoldServerTestSnippet } from "../../../core/tests";

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

function relationLoadLines(fields: Field[], pbInstance: string): string {
  return uniqueRelationCollections(fields)
    .map(
      (relatedModel) =>
        `const ${relatedModel.pluralName} = await ${pbInstance}.collection("${relatedModel.tableName}").getFullList();`,
    )
    .join("\n\t\t\t");
}

function relationLoadReturnVars(fields: Field[]): string {
  return uniqueRelationCollections(fields)
    .map((relatedModel) => relatedModel.pluralName)
    .join(", ");
}

function pbInstance(
  options: Pick<Options, "features">,
): "locals.pb" | "locals.admin" {
  return options.features.auth ? "locals.pb" : "locals.admin";
}

function formScript(
  model: Model,
  fields: Field[],
  includeParams = false,
): string {
  const labels = selectLabelMaps(fields);
  const paramsLine = includeParams
    ? "let { data, params } = $props();"
    : "let { data } = $props();";

  return dedent`
    ${labels}
    ${paramsLine}

    const form = superForm(untrack(() => data.form), {
      validators: zod4Client(${model.schemaName}),
    });

    const { form: formData } = form;
  `;
}

function newPageSnippet(
  model: Model,
  urls: ReturnType<typeof modelUrls>,
  fields: Field[],
): string {
  const hasSelectFields = fields.some((field) => field.type === "select");
  const imports = uniqueImports([
    'import { untrack } from "svelte";',
    'import { superForm } from "sveltekit-superforms";',
    'import { zod4Client } from "sveltekit-superforms/adapters";',
    `import { ${model.schemaName} } from "$lib/schemas/${model.name}";`,
    ...getFieldImports(getFieldComponents(fields)),
    'import { Button } from "$lib/components/ui/button";',
    'import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";',
    'import * as Form from "$lib/components/ui/form";',
    hasSelectFields
      ? 'import type { Models } from "@velastack/pocketbase";'
      : "",
  ]).join("\n");
  const fieldContent = fields.map((field) => renderField(field)).join("\n");
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";

  return dedent`
    <script lang="ts">
      ${imports}
      ${formScript(model, fields)}
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">New ${model.displayName.toLowerCase()}</h1>
        <Button href="${urls.list}" variant="outline" size="sm">
          <ArrowLeftIcon class="w-4 h-4" />
          Back to list
        </Button>
      </div>

      <div class="bg-card rounded-lg shadow-sm border p-4">
        <form method="POST"${enctype}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${fieldContent}
          </div>
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Form.Button size="sm">Save</Form.Button>
            <Button href="${urls.list}" variant="outline" size="sm">Cancel</Button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function editPageSnippet(
  model: Model,
  urls: ReturnType<typeof modelUrls>,
  fields: Field[],
): string {
  const hasSelectFields = fields.some((field) => field.type === "select");
  const imports = uniqueImports([
    'import { untrack } from "svelte";',
    'import { superForm } from "sveltekit-superforms";',
    'import { zod4Client } from "sveltekit-superforms/adapters";',
    `import { ${model.schemaName} } from "$lib/schemas/${model.name}";`,
    ...getFieldImports(getFieldComponents(fields)),
    'import { Button } from "$lib/components/ui/button";',
    'import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";',
    'import * as Form from "$lib/components/ui/form";',
    hasSelectFields
      ? 'import type { Models } from "@velastack/pocketbase";'
      : "",
  ]).join("\n");
  const fieldContent = fields.map((field) => renderField(field)).join("\n");
  const enctype = hasFiles(fields) ? ' enctype="multipart/form-data"' : "";
  return dedent`
    <script lang="ts">
      ${imports}
      ${formScript(model, fields, true)}
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">Edit ${model.displayName.toLowerCase()}</h1>
        <Button href="${urls.list}" variant="outline" size="sm">
          <ArrowLeftIcon class="w-4 h-4" />
          Back to list
        </Button>
      </div>

      <div class="bg-card rounded-lg shadow-sm border p-4">
        <form method="POST"${enctype}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${fieldContent}
          </div>
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Form.Button size="sm">Save changes</Form.Button>
            <Button href="${urls.list}/\${params.id}" variant="outline" size="sm">Cancel</Button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function listPageSnippet(
  model: Model,
  urls: ReturnType<typeof modelUrls>,
  fields: Field[],
): string {
  const hasSelectFields = fields.some((field) => field.type === "select");
  const selectFieldsLabelMaps = hasSelectFields
    ? `${selectLabelMaps(fields)}`
    : "";
  const columnDefs = fields
    .map((field) => {
      let cellParams = "{ getValue }";
      let cellProps = "{ value: getValue() }";

      if (field.type === "relation") {
        cellParams = "{ getValue, row }";
        cellProps = `{ value: getValue(), expanded: row.original.expand?.${field.name}, displayField: "${field.displayField}" }`;
      }

      if (field.type === "select") {
        cellProps = `{ value: getValue(), options: ${field.name}Labels }`;
      }

      if (field.type === "file") {
        cellParams = "{ getValue, row }";
        cellProps =
          "{ value: getValue(), collectionId: row.original.collectionId, id: row.original.id }";
      }

      return dedent`
        columnHelper.accessor("${field.name}", {
          header: ({ column }) => renderComponent(ColumnHeader, { column, title: "${field.title}" }),
          cell: (${cellParams}) => renderComponent(Cells.${field.type.charAt(0).toUpperCase() + field.type.slice(1)}Cell, ${cellProps})
        })
      `;
    })
    .join(",\n");
  const filterFields = fields
    .filter((field) => field.type === "select")
    .map(
      (field) =>
        `<FacetedFilter column={table.getColumn("${field.name}")!} title="${field.title}" options={Object.values(${field.name}Labels)} />`,
    )
    .join("\n");

  return dedent`
    <script lang="ts">
      import {
        type ColumnFiltersState,
        type PaginationState,
        type RowSelectionState,
        type SortingState,
        type VisibilityState,
        getCoreRowModel,
        getFacetedRowModel,
        getFacetedUniqueValues,
        getFilteredRowModel,
        getPaginationRowModel,
        getSortedRowModel,
        createColumnHelper
      } from "@tanstack/table-core";
      import { createSvelteTable, FlexRender, renderComponent } from "$lib/components/ui/data-table";
      import * as Table from "$lib/components/ui/table";
      import { Checkbox } from "$lib/components/ui/checkbox";
      import { ColumnHeader } from "$lib/components/ui/column-header";
      import { Pagination } from "$lib/components/ui/pagination";
      import { RowActions } from "$lib/components/ui/row-actions";
      import * as Cells from "$lib/components/ui/cells";
      import { Button } from "$lib/components/ui/button";
      import { Input } from "$lib/components/ui/input";
      ${hasSelectFields ? 'import { FacetedFilter } from "$lib/components/ui/faceted-filter";' : ""}
      import XIcon from "@lucide/svelte/icons/x";
      import PlusIcon from "@lucide/svelte/icons/plus";
      import type { Models } from "@velastack/pocketbase";

      let { data } = $props();
      let rowSelection = $state<RowSelectionState>({});
      let columnVisibility = $state<VisibilityState>({});
      let columnFilters = $state<ColumnFiltersState>([]);
      let sorting = $state<SortingState>([]);
      let pagination = $state<PaginationState>({ pageIndex: 0, pageSize: 10 });

      ${selectFieldsLabelMaps}

      const columnHelper = createColumnHelper<Models["${model.tableName}"]>();
      const columns = [
        columnHelper.display({
          id: "select",
          header: ({ table }) =>
            renderComponent(Checkbox, {
              checked: table.getIsAllPageRowsSelected(),
              onCheckedChange: (value) => table.toggleAllPageRowsSelected(value),
              indeterminate: table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(),
              "aria-label": "Select all"
            }),
          cell: ({ row }) =>
            renderComponent(Checkbox, {
              checked: row.getIsSelected(),
              onCheckedChange: (value) => row.toggleSelected(value),
              "aria-label": "Select row"
            }),
          enableSorting: false,
          enableHiding: false,
          meta: { class: "w-0" },
        }),
        ${columnDefs}${fields.length > 0 ? "," : ""}
        columnHelper.display({
          id: "actions",
          cell: ({ row }) =>
            renderComponent(RowActions, {
              viewPath: \`${urls.list}/\${row.original.id}\`,
              editPath: \`${urls.list}/\${row.original.id}/edit\`,
              deletePath: \`${urls.list}/\${row.original.id}\`
            }),
          meta: { class: "w-0 text-right" },
        })
      ];

      const table = createSvelteTable({
        get data() {
          return data.${model.pluralName};
        },
        state: {
          get sorting() {
            return sorting;
          },
          get columnVisibility() {
            return columnVisibility;
          },
          get rowSelection() {
            return rowSelection;
          },
          get columnFilters() {
            return columnFilters;
          },
          get pagination() {
            return pagination;
          }
        },
        columns,
        enableRowSelection: true,
        onRowSelectionChange: (updater) => {
          rowSelection = typeof updater === "function" ? updater(rowSelection) : updater;
        },
        onSortingChange: (updater) => {
          sorting = typeof updater === "function" ? updater(sorting) : updater;
        },
        onColumnFiltersChange: (updater) => {
          columnFilters = typeof updater === "function" ? updater(columnFilters) : updater;
        },
        onColumnVisibilityChange: (updater) => {
          columnVisibility = typeof updater === "function" ? updater(columnVisibility) : updater;
        },
        onPaginationChange: (updater) => {
          pagination = typeof updater === "function" ? updater(pagination) : updater;
        },
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues()
      });
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">${model.pluralDisplayName}</h1>
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex flex-1 items-center space-x-2">
            <Input
              placeholder="Filter ${model.pluralDisplayName.toLowerCase()}..."
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              oninput={(e) => {
                table.getColumn("name")?.setFilterValue(e.currentTarget.value);
              }}
              onchange={(e) => {
                table.getColumn("name")?.setFilterValue(e.currentTarget.value);
              }}
              class="h-8 w-[150px] lg:w-[250px]"
            />
            ${filterFields}
            {#if table.getState().columnFilters.length > 0}
              <Button variant="ghost" onclick={() => table.resetColumnFilters()} class="h-8 px-2 lg:px-3">
                Reset
                <XIcon />
              </Button>
            {/if}
          </div>

          <Button href="${urls.new}" variant="outline" size="sm">
            <PlusIcon class="w-4 h-4" />
            New ${model.displayName.toLowerCase()}
          </Button>
        </div>

        <div class="rounded-md border overflow-hidden">
          <Table.Root>
            <Table.Header>
              {#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
                <Table.Row>
                  {#each headerGroup.headers as header (header.id)}
                    <Table.Head colspan={header.colSpan} class={header.column.columnDef.meta?.class}>
                      {#if !header.isPlaceholder}
                        <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
                      {/if}
                    </Table.Head>
                  {/each}
                </Table.Row>
              {/each}
            </Table.Header>
            <Table.Body>
              {#each table.getRowModel().rows as row (row.id)}
                <Table.Row data-state={row.getIsSelected() && "selected"}>
                  {#each row.getVisibleCells() as cell (cell.id)}
                    <Table.Cell class={cell.column.columnDef.meta?.class}>
                      <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                    </Table.Cell>
                  {/each}
                </Table.Row>
              {:else}
                <Table.Row>
                  <Table.Cell colspan={columns.length} class="h-24 text-center">No results.</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>

        <Pagination {table} />
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
  urls: ReturnType<typeof modelUrls>,
  fields: Field[],
  pb: string,
  authMode: boolean,
): string {
  const withFiles = hasFiles(fields);
  const relationLoads = relationLoadLines(fields, pb);
  const relationVars = relationLoadReturnVars(fields);
  const relationReturn = relationVars ? `, ${relationVars}` : "";
  const currentUserField = fields.find(
    (field): field is Extract<Field, { type: "relation" }> =>
      field.type === "relation" && field.isCurrentUser,
  );
  const createPayload =
    authMode && currentUserField
      ? dedent`
        {
          ...form.data,
          ${currentUserField.name}: locals.pb.authStore.record?.id
        }
      `
      : "form.data";

  return dedent`
    import { fail, redirect } from "@sveltejs/kit";
    import { superValidate${withFiles ? ", withFiles" : ""} } from "sveltekit-superforms";
    import { zod4 } from "sveltekit-superforms/adapters";
    import { setPocketbaseErrors } from "@velastack/pocketbase";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";

    export const load = async ({ locals }) => {
      ${relationLoads}
      return { form: await superValidate(zod4(${model.schemaName}))${relationReturn} };
    };

    export const actions = {
      default: async ({ locals, request }) => {
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

        return redirect(303, \`${urls.list}/\${${model.name}.id}\`);
      },
    };
  `;
}

function showServerSnippet(
  model: Model,
  urls: ReturnType<typeof modelUrls>,
  fields: Field[],
  pb: string,
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
        throw redirect(303, "${urls.list}");
      },
    };
  `;
}

function showPageSnippet(
  model: Model,
  urls: ReturnType<typeof modelUrls>,
  fields: Field[],
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

  return dedent`
    <script lang="ts">
      ${imports}
      ${labels}

      let { data } = $props();
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">${model.displayName} details</h1>
        <Button href="${urls.list}" variant="outline" size="sm">
          <ArrowLeftIcon class="w-4 h-4" />
          Back to list
        </Button>
      </div>

      <div class="bg-card rounded-lg shadow-sm border p-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          ${displays}
        </div>

        <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4 justify-between">
          <Button href="${urls.list}/{data.${model.name}.id}/edit" variant="outline" size="sm">
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

function editServerSnippet(
  model: Model,
  urls: ReturnType<typeof modelUrls>,
  fields: Field[],
  pb: string,
): string {
  const withFiles = hasFiles(fields);
  const relationLoads = relationLoadLines(fields, pb);
  const relationVars = relationLoadReturnVars(fields);
  const relationReturn = relationVars ? `, ${relationVars}` : "";
  return dedent`
    import { error, fail, redirect } from "@sveltejs/kit";
    import { setPocketbaseErrors, setDefaultData } from "@velastack/pocketbase";
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
          await ${pb}.collection("${model.tableName}").update(params.id, form.data);
          return redirect(303, \`${urls.list}/\${params.id}\`);
        } catch (error) {
          setPocketbaseErrors(form, error);
          setDefaultData(form, ${model.name});
          return fail(400, ${withFiles ? "withFiles({ form })" : "{ form }"});
        }
      },
    };
  `;
}

export async function generate(options: Options) {
  const { modelPath, fields: fieldDefs } = parsePatternArgs(options.argv);
  const { model, fields, auth, shouldCreateCollection, collections } =
    await resolveInputFields(options, modelPath, fieldDefs);
  const paths = modelPaths(model);
  const urls = modelUrls(model);
  const pb = pbInstance(options);
  const uiFields = fields.filter(
    (field) => !(field.type === "relation" && field.isCurrentUser),
  );

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
      listPageSnippet(model, urls, uiFields),
    ),
    toFile(
      `${paths.new}/+page.server.ts`,
      newServerSnippet(model, urls, uiFields, pb, options.features.auth),
    ),
    toFile(`${paths.new}/+page.svelte`, newPageSnippet(model, urls, uiFields)),
    toFile(
      `${paths.show}/+page.server.ts`,
      showServerSnippet(model, urls, uiFields, pb),
    ),
    toFile(
      `${paths.show}/+page.svelte`,
      showPageSnippet(model, urls, uiFields),
    ),
    toFile(
      `${paths.edit}/+page.server.ts`,
      editServerSnippet(model, urls, uiFields, pb),
    ),
    toFile(
      `${paths.edit}/+page.svelte`,
      editPageSnippet(model, urls, uiFields),
    ),
    toFile(
      `${paths.list}/server.test.ts`,
      generateScaffoldServerTestSnippet(
        model,
        urls,
        fields,
        options,
        collections,
      ),
    ),
  ];

  const components = [
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
  ] as Component[];

  return {
    creates,
    modifies: [],
    deletes: [],
    components: [...new Set(components)],
    packages: ["@tanstack/table-core"],
    collections: shouldCreateCollection
      ? [collectionSpecFromModelFields(model, fields, auth)]
      : [],
  } satisfies Result;
}
