import dedent from "dedent";
import type { Field, Model, ScaffoldUrls, SelectField } from "../parse";
import { selectFieldLabelMap } from "./field";
import { renderPlainValue } from "./field/plain-display";
import { urlJsExprWithSuffix, urlSvelteAttrValue } from "./url";

/**
 * The list page of the scaffold generators (`generate-scaffold` and
 * `generate-scaffold-remote` share it): a TanStack Table v9 data table built
 * from the helpers under `src/ui/components`, or a native `<table>` without
 * shadcn-svelte.
 */

function selectFields(fields: Field[]): SelectField[] {
  return fields.filter(
    (field): field is SelectField => field.type === "select",
  );
}

function labelMaps(fields: Field[]): string {
  return selectFields(fields)
    .map((field) => selectFieldLabelMap(field))
    .join("\n\n");
}

/** `params` is declared only where a URL interpolates a dynamic segment (noUnusedLocals). */
function propsLine(dynamicParams: string[]): string {
  return dynamicParams.length > 0
    ? "let { data, params } = $props();"
    : "let { data } = $props();";
}

/** The column the search box filters: the first free-text one, if any. */
function searchField(fields: Field[]): Field | undefined {
  return fields.find((field) => ["text", "email", "url"].includes(field.type));
}

/**
 * The filter each filterable column registers. A facet sets an array of
 * option values: a single select matches one of them exactly (`arrHas`), a
 * multi select any of its own (`arrIncludesSome`).
 */
function filterFnName(field: Field, search: Field | undefined): string | null {
  if (field === search) return "includesString";
  if (field.type === "select") {
    return field.maxSelect > 1 ? "arrIncludesSome" : "arrHas";
  }
  return null;
}

function cellSnippet(field: Field): string {
  const component = `Cells.${field.type.charAt(0).toUpperCase() + field.type.slice(1)}Cell`;
  switch (field.type) {
    case "relation":
      return `({ getValue, row }) => renderComponent(${component}, { value: getValue(), expanded: row.original.expand?.${field.name}, displayField: "${field.displayField}" })`;
    case "select":
      return `({ getValue }) => renderComponent(${component}, { value: getValue(), options: ${field.name}Labels })`;
    case "file":
      return `({ getValue, row }) => renderComponent(${component}, { value: getValue(), collectionId: row.original.collectionId, id: row.original.id })`;
    default:
      return `({ getValue }) => renderComponent(${component}, { value: getValue() })`;
  }
}

export function listPageSnippet(
  model: Model,
  urls: ScaffoldUrls,
  fields: Field[],
  dynamicParams: string[],
): string {
  const selects = selectFields(fields);
  const search = searchField(fields);
  const hasFilters = Boolean(search) || selects.length > 0;
  const filterFns = [
    ...new Set(
      fields
        .map((field) => filterFnName(field, search))
        .filter((name): name is string => name !== null),
    ),
  ];

  const newHref = urlSvelteAttrValue(urls.new, dynamicParams);
  const rowPath = (suffix: string) =>
    urlJsExprWithSuffix(
      urls.list,
      dynamicParams,
      `/\${row.original.id}${suffix}`,
    );

  const columnDefs = fields
    .map((field) => {
      const filterFn = filterFnName(field, search);
      return dedent`
        columnHelper.accessor("${field.name}", {
          header: ({ column }) => renderComponent(ColumnHeader, { column, title: "${field.title}" }),
          cell: ${cellSnippet(field)},${filterFn ? `\nfilterFn: "${filterFn}",` : ""}
        })
      `;
    })
    .join(",\n");

  const tableCoreImports = [
    "columnFilteringFeature",
    "createColumnHelper",
    "createFilteredRowModel",
    "createPaginatedRowModel",
    "createSortedRowModel",
    "rowPaginationFeature",
    "rowSelectionFeature",
    "rowSortingFeature",
    "sortFn_alphanumeric",
    "sortFn_text",
    "tableFeatures",
    ...(selects.length > 0
      ? [
          "columnFacetingFeature",
          "createFacetedRowModel",
          "createFacetedUniqueValues",
        ]
      : []),
    ...filterFns.map((name) => `filterFn_${name}`),
  ].sort();

  const facetingSlots =
    selects.length > 0
      ? dedent`
        columnFacetingFeature,
        facetedRowModel: createFacetedRowModel(),
        facetedUniqueValues: createFacetedUniqueValues(),
      `
      : "";
  const filterFnsSlot =
    filterFns.length > 0
      ? `filterFns: { ${filterFns.map((name) => `${name}: filterFn_${name}`).join(", ")} },`
      : "";

  const searchInput = search
    ? dedent`
      <Input
        placeholder="Filter ${model.pluralDisplayName.toLowerCase()}..."
        value={(table.getColumn("${search.name}")?.getFilterValue() as string) ?? ""}
        oninput={(e) => {
          table.getColumn("${search.name}")?.setFilterValue(e.currentTarget.value);
        }}
        class="h-8 w-[150px] lg:w-[250px]"
      />
    `
    : "";
  const facets = selects
    .map(
      (field) =>
        `<FacetedFilter column={table.getColumn("${field.name}")!} title="${field.title}" options={Object.values(${field.name}Labels)} />`,
    )
    .join("\n");
  const toolbar = hasFilters
    ? dedent`
      <div class="flex flex-1 items-center space-x-2">
        ${searchInput}
        ${facets}
        {#if table.atoms.columnFilters.get().length > 0}
          <Button variant="ghost" onclick={() => table.resetColumnFilters()} class="h-8 px-2 lg:px-3">
            Reset
            <XIcon />
          </Button>
        {/if}
      </div>
    `
    : '<div class="flex-1"></div>';

  const imports = [
    `import {\n${tableCoreImports.join(",\n")}\n} from "@tanstack/table-core";`,
    'import { createTable, FlexRender, renderComponent } from "$lib/components/ui/data-table";',
    'import * as Table from "$lib/components/ui/table";',
    'import { Checkbox } from "$lib/components/ui/checkbox";',
    'import { ColumnHeader } from "$lib/components/ui/column-header";',
    'import { Pagination } from "$lib/components/ui/pagination";',
    'import { RowActions } from "$lib/components/ui/row-actions";',
    'import * as Cells from "$lib/components/ui/cells";',
    'import { Button } from "$lib/components/ui/button";',
    search ? 'import { Input } from "$lib/components/ui/input";' : "",
    selects.length > 0
      ? 'import { FacetedFilter } from "$lib/components/ui/faceted-filter";'
      : "",
    hasFilters ? 'import XIcon from "@lucide/svelte/icons/x";' : "",
    'import PlusIcon from "@lucide/svelte/icons/plus";',
    'import type { Models } from "@velastack/pocketbase";',
  ]
    .filter(Boolean)
    .join("\n");

  return dedent`
    <script lang="ts">
      ${imports}

      ${propsLine(dynamicParams)}

      ${labelMaps(fields)}

      const features = tableFeatures({
        rowSelectionFeature,
        rowSortingFeature,
        columnFilteringFeature,
        rowPaginationFeature,
        ${facetingSlots}
        sortedRowModel: createSortedRowModel(),
        filteredRowModel: createFilteredRowModel(),
        paginatedRowModel: createPaginatedRowModel(),
        sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
        ${filterFnsSlot}
      });

      const columnHelper = createColumnHelper<typeof features, Models["${model.tableName}"]>();
      const columns = columnHelper.columns([
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
          meta: { class: "w-0" },
        }),
        ${columnDefs}${fields.length > 0 ? "," : ""}
        columnHelper.display({
          id: "actions",
          cell: ({ row }) =>
            renderComponent(RowActions, {
              viewPath: ${rowPath("")},
              editPath: ${rowPath("/edit")},
              deletePath: ${rowPath("")}
            }),
          meta: { class: "w-0 text-right" },
        })
      ]);

      const table = createTable({
        features,
        columns,
        get data() {
          return data.${model.pluralName};
        },
        enableRowSelection: true,
      });
    </script>

    <section data-role="content">
      <div class="flex justify-between items-center mb-4">
        <h1 class="text-3xl font-bold tracking-tight">${model.pluralDisplayName}</h1>
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          ${toolbar}

          <Button href${newHref} variant="outline" size="sm">
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
                        <FlexRender {header} />
                      {/if}
                    </Table.Head>
                  {/each}
                </Table.Row>
              {/each}
            </Table.Header>
            <Table.Body>
              {#each table.getRowModel().rows as row (row.id)}
                <Table.Row data-state={row.getIsSelected() && "selected"}>
                  {#each row.getAllCells() as cell (cell.id)}
                    <Table.Cell class={cell.column.columnDef.meta?.class}>
                      <FlexRender {cell} />
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

/**
 * The list page without shadcn-svelte, TanStack Table or tailwind: a native
 * `<table>` of every record, each row linking to its detail and edit pages
 * and carrying a delete form that posts to the detail page's action.
 */
export function plainListPageSnippet(
  model: Model,
  urls: ScaffoldUrls,
  fields: Field[],
  dynamicParams: string[],
): string {
  const record = model.name;
  const recordHref = (suffix = "") =>
    urlSvelteAttrValue(urls.list, dynamicParams, `/{${record}.id}${suffix}`);
  const headers = fields
    .map((field) => `<th scope="col">${field.title}</th>`)
    .join("\n");
  const cells = fields
    .map((field) => `<td>${renderPlainValue(field, record)}</td>`)
    .join("\n");

  return dedent`
    <script lang="ts">
      ${propsLine(dynamicParams)}

      ${labelMaps(fields)}
    </script>

    <h1>${model.pluralDisplayName}</h1>

    <p><a href${urlSvelteAttrValue(urls.new, dynamicParams)}>New ${model.displayName.toLowerCase()}</a></p>

    <table>
      <thead>
        <tr>
          ${headers}
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.${model.pluralName} as ${record} (${record}.id)}
          <tr>
            ${cells}
            <td>
              <a href${recordHref()}>View</a>
              <a href${recordHref("/edit")}>Edit</a>
              <form method="POST" action${recordHref()}>
                <button type="submit">Delete</button>
              </form>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="${fields.length + 1}">No ${model.pluralDisplayName.toLowerCase()} yet.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  `;
}
