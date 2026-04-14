import { dedent } from "ts-dedent";
import type { Component, File, Options, Result } from "../../../core/types";
import { languageFromPath } from "../../../core/util";
import {
  modelPaths,
  parseFields,
  parseModel,
  validateModelName,
  type Field,
  type Model,
} from "../../../parse";

const FORM_ARG_INDEX = 2;
const FIELD_START_INDEX = 3;

type FieldComponent =
  | "form"
  | "file-form"
  | "multiselect"
  | "input"
  | "checkbox"
  | "textarea"
  | "select"
  | "geopoint"
  | "button";

const FIELD_COMPONENTS: Record<Field["type"], FieldComponent[]> = {
  text: ["form", "input"],
  number: ["form", "input"],
  email: ["form", "input"],
  password: ["form", "input"],
  bool: ["form", "checkbox"],
  date: ["form", "input"],
  select: ["form", "multiselect"],
  file: ["form", "input", "file-form", "button"],
  json: ["form", "textarea"],
  geoPoint: ["form", "geopoint"],
  relation: ["form", "multiselect"],
  url: ["form", "input"],
  editor: ["form", "textarea"],
  autodate: ["form", "input"],
};

const FIELD_IMPORTS: Record<FieldComponent, string[]> = {
  form: ['import * as Form from "$lib/components/ui/form";'],
  "file-form": ['import * as FileForm from "$lib/components/ui/file-form";'],
  multiselect: [
    'import * as MultiSelect from "$lib/components/ui/multiselect";',
    'import * as Command from "$lib/components/ui/command";',
  ],
  input: ['import { Input } from "$lib/components/ui/input";'],
  checkbox: ['import { Checkbox } from "$lib/components/ui/checkbox";'],
  textarea: ['import { Textarea } from "$lib/components/ui/textarea";'],
  select: ['import * as Select from "$lib/components/ui/select";'],
  geopoint: ['import { GeopointInput } from "$lib/components/ui/geopoint";'],
  button: ['import { Button } from "$lib/components/ui/button";'],
};

function parseCommandArgs(argv: string[]) {
  if (argv.length <= FORM_ARG_INDEX) {
    throw new Error(
      "Invalid command arguments. Expected: generate form <model> <fields...>",
    );
  }

  const [command, subcommand] = argv;
  if (command !== "generate" || subcommand !== "form") {
    throw new Error(
      `Invalid command "${argv.join(" ")}". Expected to start with "generate form".`,
    );
  }

  const modelPath = argv[FORM_ARG_INDEX];
  const fields = argv.slice(FIELD_START_INDEX);
  if (fields.length === 0) {
    throw new Error("At least one field definition is required.");
  }

  return { modelPath, fields };
}

function hasFiles(fields: Field[]): boolean {
  return fields.some((field) => field.type === "file");
}

function escapeFieldName(fieldName: string): string {
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  return validIdentifierRegex.test(fieldName) ? fieldName : `'${fieldName}'`;
}

function fieldValueBinding(field: Field): string {
  return `$formData.${field.name}`;
}

function getFormSchemaForField(field: Field): string {
  const selectValues =
    field.type === "select"
      ? `[${field.options.map((option) => JSON.stringify(option.value)).join(", ")}]`
      : "";

  let schema: string;
  switch (field.type) {
    case "text":
      schema = "z.string()";
      break;
    case "number":
      schema = "z.number()";
      break;
    case "bool":
      schema = "z.boolean().default(false)";
      break;
    case "date":
      schema = "z.string()";
      break;
    case "email":
      schema = "z.string().email()";
      break;
    case "password":
      schema = "z.string()";
      break;
    case "url":
      schema = "z.string().url()";
      break;
    case "editor":
      schema = "z.string()";
      break;
    case "autodate":
      schema = "z.string()";
      break;
    case "select":
      if (selectValues) {
        schema =
          field.maxSelect > 1
            ? `z.array(z.enum(${selectValues}))`
            : `z.enum(${selectValues})`;
      } else {
        schema = "z.string()";
      }
      break;
    case "file":
      schema =
        field.maxSelect > 1
          ? "z.string().array()"
          : "z.union([z.instanceof(File), z.string()])";
      break;
    case "json":
      schema = "z.any()";
      break;
    case "geoPoint":
      schema = `z.preprocess((val) => {
  if (typeof val === "string") {
    return val;
  }
  return JSON.stringify(val);
}, z.string()${field.required ? "" : ".optional()"}) as z.ZodEffects<${field.required ? "" : "z.ZodOptional<"}z.ZodString${field.required ? "" : ">"}, any, any>`;
      break;
    case "relation":
      schema = field.maxSelect > 1 ? "z.array(z.string())" : "z.string()";
      break;
    default: {
      const exhaustiveType: never = field;
      return exhaustiveType;
    }
  }

  const nonEmptyTypes: Field["type"][] = ["text"];
  if (nonEmptyTypes.includes(field.type)) {
    return field.required ? `${schema}.nonempty()` : `${schema}.optional()`;
  }

  if (field.required) {
    return schema;
  }

  if (field.type === "geoPoint") {
    return schema;
  }

  if (field.type === "file" && field.maxSelect <= 1) {
    return `${schema}.optional().default("")`;
  }

  return `${schema}.optional()`;
}

function schemaFields(fields: Field[]): Array<{ name: string; schema: string }> {
  const allFields: Array<{ name: string; schema: string }> = [];

  for (const field of fields) {
    if (field.type === "file" && field.maxSelect > 1) {
      allFields.push({
        name: field.name,
        schema: getFormSchemaForField({ ...field, required: false }),
      });
      allFields.push({
        name: `${field.name}+`,
        schema: "z.instanceof(File).array().optional()",
      });
      allFields.push({
        name: `${field.name}-`,
        schema: "z.string().array().optional()",
      });
      continue;
    }

    allFields.push({ name: field.name, schema: getFormSchemaForField(field) });
  }

  return allFields;
}

function generateSchema(model: Model, fields: Field[]): string {
  const fieldLines = schemaFields(fields)
    .map((field) => `${escapeFieldName(field.name)}: ${field.schema}`)
    .join(",\n  ");

  return dedent`
    import { z } from "zod/v3";

    export const ${model.schemaName} = z.object({
      ${fieldLines}
    });
  `;
}

function selectFieldLabelMap(field: Extract<Field, { type: "select" }>): string {
  const labels = field.options
    .map(
      (option) => dedent`
        ${JSON.stringify(option.value)}: {
          label: ${JSON.stringify(option.label)},
          value: ${JSON.stringify(option.value)}
        }
      `,
    )
    .join(",\n");

  return dedent`
    const ${field.name}Labels = {
      ${labels}
    } as const;
  `;
}

function renderInputField(field: Field, type: string): string {
  const required = field.required ? " required" : "";
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>${field.title}</Form.Label>
          <Input {...props} type="${type}" bind:value={${fieldValueBinding(field)}}${required} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

function renderTextareaField(field: Field): string {
  const required = field.required ? " required" : "";
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-2">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>${field.title}</Form.Label>
          <Textarea {...props} bind:value={${fieldValueBinding(field)}}${required} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

function renderBoolField(field: Field): string {
  const required = field.required ? " required" : "";
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-1 flex items-start space-x-2">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox {...props} bind:checked={${fieldValueBinding(field)}}${required} />
          <Form.Label>${field.title}</Form.Label>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

function renderGeoPointField(field: Field): string {
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>${field.title}</Form.Label>
          <GeopointInput {...props} bind:value={${fieldValueBinding(field)}} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

function renderFileField(field: Extract<Field, { type: "file" }>): string {
  const required = field.required ? " required" : "";
  const fileMode = field.maxSelect > 1 ? "Multiple" : "Single";

  return dedent`
    <FileForm.Field {form} name="${field.name}" class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>${field.title}</Form.Label>
          <FileForm.${fileMode}>
            {#snippet display({ file, filename, onremove })}
              <div class="flex gap-2 justify-between items-center">
                <div class="flex gap-2 items-center">
                  <FileForm.Thumb {file} {filename} class="w-16 h-16 rounded-md object-cover" />
                  <p class="text-sm text-muted-foreground">{filename}</p>
                </div>
                <Button variant="outline" onclick={() => onremove(file)}>Remove</Button>
              </div>
            {/snippet}
            {#snippet input()}
              <FileForm.Input {...props}${required} />
            {/snippet}
          </FileForm.${fileMode}>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </FileForm.Field>
  `;
}

function renderSelectField(field: Extract<Field, { type: "select" }>): string {
  const multiType = field.maxSelect > 1 ? "multiple" : "single";
  const required = field.required ? " required" : "";
  const placeholder = field.maxSelect > 1 ? "Select options" : "Select an option";

  const options = field.options
    .map(
      (option) =>
        `<MultiSelect.Item value={${JSON.stringify(option.value)}} label={${field.name}Labels[${JSON.stringify(option.value)}].label} />`,
    )
    .join("\n              ");

  return dedent`
    <MultiSelect.Field {form} type="${multiType}" name="${field.name}"${required} class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>${field.title}</Form.Label>
          <MultiSelect.Trigger class="w-full justify-between">
            <MultiSelect.Input bind:value={${fieldValueBinding(field)}} placeholder="${placeholder}" {...props}>
              {#snippet children({ selected })}
                <div class="flex flex-wrap gap-1">
                  {#each selected as value}
                    <MultiSelect.Chip>{${field.name}Labels[value].label}</MultiSelect.Chip>
                  {/each}
                </div>
              {/snippet}
            </MultiSelect.Input>
          </MultiSelect.Trigger>
        {/snippet}
      </Form.Control>

      <MultiSelect.Content class="p-0">
        <Command.Root>
          <Command.Input autofocus placeholder="Search..." />
          <Command.Empty>No options found</Command.Empty>
          <Command.Group>
              ${options}
          </Command.Group>
        </Command.Root>
      </MultiSelect.Content>

      <Form.FieldErrors class="contents text-destructive" />
    </MultiSelect.Field>
  `;
}

function renderRelationField(field: Extract<Field, { type: "relation" }>): string {
  const multiType = field.maxSelect > 1 ? "multiple" : "single";
  const placeholder =
    field.maxSelect > 1
      ? `Select ${field.relatedModel.pluralDisplayName.toLowerCase()}`
      : `Select ${field.relatedModel.displayName.toLowerCase()}`;
  const searchPlaceholder = `Search ${field.relatedModel.pluralDisplayName.toLowerCase()}...`;
  const emptyText = `No ${field.relatedModel.pluralDisplayName.toLowerCase()} found`;
  const modelName = field.relatedModel.name;
  const listName = field.relatedModel.pluralName;

  return dedent`
    <MultiSelect.Field {form} type="${multiType}" name="${field.name}" class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          <Form.Label>${field.title}</Form.Label>
          <MultiSelect.Trigger class="w-full justify-between">
            <MultiSelect.Input bind:value={${fieldValueBinding(field)}} placeholder="${placeholder}" {...props}>
              {#snippet children({ selected })}
                <div class="flex flex-wrap gap-1">
                  {#each selected as value}
                    {@const ${modelName} = data.${listName}.find((${modelName}) => ${modelName}.id === value)!}
                    <MultiSelect.Chip>{${modelName}.${field.displayField}}</MultiSelect.Chip>
                  {/each}
                </div>
              {/snippet}
            </MultiSelect.Input>
          </MultiSelect.Trigger>
        {/snippet}
      </Form.Control>

      <MultiSelect.Content class="p-0">
        <Command.Root>
          <Command.Input autofocus placeholder="${searchPlaceholder}" />
          <Command.Empty>${emptyText}</Command.Empty>
          <Command.Group>
            {#each data.${listName} as ${modelName}}
              <MultiSelect.Item value={${modelName}.id} label={${modelName}.${field.displayField}} />
            {/each}
          </Command.Group>
        </Command.Root>
      </MultiSelect.Content>

      <Form.FieldErrors class="contents text-destructive" />
    </MultiSelect.Field>
  `;
}

function renderField(field: Field): string {
  switch (field.type) {
    case "text":
      return renderInputField(field, "text");
    case "number":
      return renderInputField(field, "number");
    case "date":
      return renderInputField(field, "date");
    case "email":
      return renderInputField(field, "email");
    case "password":
      return renderInputField(field, "password");
    case "url":
      return renderInputField(field, "url");
    case "autodate":
      return dedent`
        <Form.Field {form} name="${field.name}" class="col-span-1">
          <Form.Control>
            {#snippet children({ props })}
              <Form.Label>${field.title}</Form.Label>
              <Input {...props} type="text" value={${fieldValueBinding(field)}} readonly />
            {/snippet}
          </Form.Control>
          <Form.FieldErrors class="contents text-destructive" />
        </Form.Field>
      `;
    case "editor":
    case "json":
      return renderTextareaField(field);
    case "bool":
      return renderBoolField(field);
    case "geoPoint":
      return renderGeoPointField(field);
    case "file":
      return renderFileField(field);
    case "select":
      return renderSelectField(field);
    case "relation":
      return renderRelationField(field);
    default: {
      const exhaustiveType: never = field;
      return exhaustiveType;
    }
  }
}

function getFieldComponents(fields: Field[]): FieldComponent[] {
  const components = fields.flatMap((field) => FIELD_COMPONENTS[field.type]);
  return [...new Set(components)];
}

function getFieldImports(components: FieldComponent[]): string[] {
  return [...new Set(components.flatMap((component) => FIELD_IMPORTS[component]))];
}

function pageImports(model: Model, fields: Field[]): string[] {
  const components = getFieldComponents(fields);
  const imports = [
    'import { untrack } from "svelte";',
    'import { superForm } from "sveltekit-superforms";',
    'import { zodClient } from "sveltekit-superforms/adapters";',
    `import { ${model.schemaName} } from "$lib/schemas/${model.name}";`,
    ...getFieldImports(components),
  ];

  return [...new Set(imports)];
}

function pageScriptSnippet(model: Model, fields: Field[]): string {
  const selectFields = fields.filter(
    (field): field is Extract<Field, { type: "select" }> => field.type === "select",
  );
  const labelMaps = selectFields.map((field) => selectFieldLabelMap(field)).join("\n\n");

  return dedent`
    ${labelMaps}

    const form = superForm(untrack(() => data.form), {
      validators: zodClient(${model.schemaName}),
    });

    const { form: formData } = form;
  `;
}

function pageSnippet(model: Model, fields: Field[]): string {
  const imports = pageImports(model, fields).join("\n");
  const scriptSnippet = pageScriptSnippet(model, fields);
  const fieldSnippet = fields.map((field) => renderField(field)).join("\n");
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
          <div class="mt-4 flex gap-2 border-t pt-4 -mx-4 px-4">
            <Form.Button>Submit</Form.Button>
          </div>
        </form>
      </div>
    </section>
  `;
}

function serverSnippet(model: Model, fields: Field[]): string {
  const withFiles = hasFiles(fields);
  const imports = dedent`
    import { fail, superValidate${withFiles ? ", withFiles" : ""} } from "sveltekit-superforms";
    import { zod } from "sveltekit-superforms/adapters";
    import { ${model.schemaName} } from "$lib/schemas/${model.name}";
    import { setFlash } from "sveltekit-flash-message/server";
  `;

  return dedent`
    ${imports}

    export const load = async () => {
      const form = await superValidate(zod(${model.schemaName}));
      return { form };
    };

    export const actions = {
      default: async ({ request, cookies }) => {
        const form = await superValidate(request, zod(${model.schemaName}));

        if (!form.valid) {
          return fail(400, { form });
        }

        setFlash({ type: "toast", message: "Form posted successfully" }, cookies);

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
  };
}

export async function generate(options: Options) {
  const { modelPath, fields: fieldDefs } = parseCommandArgs(options.argv);

  validateModelName(modelPath);
  const model = parseModel(modelPath, options);
  const parsed = await parseFields(fieldDefs, model, options);
  const fields = parsed.fields;
  const paths = modelPaths(model);

  const creates = [
    toFile(`${paths.new}/+page.svelte`, pageSnippet(model, fields)),
    toFile(`${paths.new}/+page.server.ts`, serverSnippet(model, fields)),
    toFile(`src/lib/schemas/${model.name}.ts`, generateSchema(model, fields)),
  ];

  const components = getFieldComponents(fields) as Component[];

  return {
    creates,
    modifies: [],
    deletes: [],
    components,
    packages: [],
  } satisfies Result;
}
