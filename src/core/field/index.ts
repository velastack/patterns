import dedent from "dedent";
import type { Field, Model } from "../../parse";

type InputPropValue = string | number | boolean | null | undefined;

interface FieldRenderExtensions {
  inputProps?: Record<string, InputPropValue>;
  labelAside?: string;
}

export type RenderableField = Field & FieldRenderExtensions;

export type FieldComponent =
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

export function fieldValueBinding(field: Pick<Field, "name">): string {
  return `$formData.${field.name}`;
}

function renderInputProps(field: RenderableField): string {
  if (!field.inputProps) {
    return "";
  }

  return Object.entries(field.inputProps)
    .flatMap(([key, value]) => {
      if (value === undefined || value === null || value === false) {
        return [];
      }

      if (value === true) {
        return [` ${key}`];
      }

      return [` ${key}=${JSON.stringify(String(value))}`];
    })
    .join("");
}

function renderLabel(field: RenderableField): string {
  if (!field.labelAside) {
    return `<Form.Label>${field.title}</Form.Label>`;
  }

  return dedent`
    <div class="flex justify-between">
      <Form.Label>${field.title}</Form.Label>
      ${field.labelAside}
    </div>
  `;
}

function renderInputField(field: RenderableField, type: string): string {
  const required = field.required ? " required" : "";
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          ${renderLabel(field)}
          <Input {...props} type="${type}" bind:value={${fieldValueBinding(field)}}${required}${renderInputProps(field)} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

function renderTextareaField(field: RenderableField): string {
  const required = field.required ? " required" : "";
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-2">
      <Form.Control>
        {#snippet children({ props })}
          ${renderLabel(field)}
          <Textarea {...props} bind:value={${fieldValueBinding(field)}}${required}${renderInputProps(field)} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

function renderBoolField(field: RenderableField): string {
  const required = field.required ? " required" : "";
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-1 flex items-start space-x-2">
      <Form.Control>
        {#snippet children({ props })}
          <Checkbox {...props} bind:checked={${fieldValueBinding(field)}}${required}${renderInputProps(field)} />
          ${renderLabel(field)}
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

function renderGeoPointField(field: RenderableField): string {
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          ${renderLabel(field)}
          <GeopointInput {...props} bind:value={${fieldValueBinding(field)}} />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

function renderFileField(field: Extract<RenderableField, { type: "file" }>): string {
  const required = field.required ? " required" : "";
  const fileMode = field.maxSelect > 1 ? "Multiple" : "Single";

  return dedent`
    <FileForm.Field {form} name="${field.name}" class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          ${renderLabel(field)}
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
              <FileForm.Input {...props}${required}${renderInputProps(field)} />
            {/snippet}
          </FileForm.${fileMode}>
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </FileForm.Field>
  `;
}

function renderSelectField(field: Extract<RenderableField, { type: "select" }>): string {
  const multiType = field.maxSelect > 1 ? "multiple" : "single";
  const required = field.required ? " required" : "";
  const placeholder = field.maxSelect > 1 ? "Select options" : "Select an option";

  const options = field.options
    .map(
      (option) =>
        `<MultiSelect.Item value=${JSON.stringify(option.value)} label={${field.name}Labels[${JSON.stringify(option.value)}].label} />`,
    )
    .join("\n              ");

  return dedent`
    <MultiSelect.Field {form} type="${multiType}" name="${field.name}"${required} class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          ${renderLabel(field)}
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

function renderRelationField(
  field: Extract<RenderableField, { type: "relation" }>,
): string {
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

function renderAutodateField(field: RenderableField): string {
  return dedent`
    <Form.Field {form} name="${field.name}" class="col-span-1">
      <Form.Control>
        {#snippet children({ props })}
          ${renderLabel(field)}
          <Input {...props} type="text" value={${fieldValueBinding(field)}}${renderInputProps(field)} readonly />
        {/snippet}
      </Form.Control>
      <Form.FieldErrors class="contents text-destructive" />
    </Form.Field>
  `;
}

export function renderField(field: RenderableField): string {
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
      return renderAutodateField(field);
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

export function selectFieldLabelMap(field: Extract<Field, { type: "select" }>): string {
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

export function getFieldComponents(fields: Field[]): FieldComponent[] {
  const components = fields.flatMap((field) => FIELD_COMPONENTS[field.type]);
  return [...new Set(components)];
}

export function getFieldImports(components: FieldComponent[]): string[] {
  return [...new Set(components.flatMap((component) => FIELD_IMPORTS[component]))];
}

function displayDataPath(model: Model, field: Pick<Field, "name">): string {
  return `data.${model.name}.${field.name}`;
}

function renderDisplaySimple(
  model: Model,
  field: Pick<Field, "name" | "title">,
  valueExpression: string,
): string {
  return dedent`
    <div class="space-y-2">
      <h3 class="font-medium leading-none">${field.title}</h3>
      <p class="text-muted-foreground">${valueExpression}</p>
    </div>
  `;
}

function renderDisplayDateField(
  model: Model,
  field: Field & { type: "date" | "autodate" },
): string {
  const dataPath = displayDataPath(model, field);
  const dateLine = `<p class="text-muted-foreground">{new Date(${dataPath}).toLocaleDateString()}</p>`;
  const body = field.required
    ? dateLine
    : dedent`
      {#if ${dataPath}}
        ${dateLine}
      {/if}
    `;

  return dedent`
    <div class="space-y-2">
      <h3 class="font-medium leading-none">${field.title}</h3>
      ${body}
    </div>
  `;
}

function renderDisplayUrlField(model: Model, field: Field & { type: "url" }): string {
  const dataPath = displayDataPath(model, field);
  const anchor = dedent`
    <a href={${dataPath}} target="_blank" rel="noopener noreferrer">
      {${dataPath}}
    </a>
  `;
  const body = field.required
    ? anchor
    : dedent`
      {#if ${dataPath}}
        ${anchor}
      {/if}
    `;

  return dedent`
    <div class="space-y-2">
      <h3 class="font-medium leading-none">${field.title}</h3>
      <p class="text-muted-foreground">
        ${body}
      </p>
    </div>
  `;
}

function renderDisplaySelectField(
  model: Model,
  field: Extract<Field, { type: "select" }>,
): string {
  const dataPath = displayDataPath(model, field);
  if (field.maxSelect > 1) {
    return dedent`
      <div class="space-y-2">
        <h3 class="font-medium leading-none">${field.title}</h3>
        {#each ${dataPath} as ${field.name}}
          <Badge variant="outline" class="mr-1">{${field.name}Labels[${field.name}].label}</Badge>
        {/each}
      </div>
    `;
  }

  const badge = `<Badge variant="outline" class="mr-1">{${field.name}Labels[${dataPath}].label}</Badge>`;
  const body = field.required
    ? badge
    : dedent`
      {#if ${dataPath}}
        ${badge}
      {/if}
    `;

  return dedent`
    <div class="space-y-2">
      <h3 class="font-medium leading-none">${field.title}</h3>
      ${body}
    </div>
  `;
}

function renderDisplayFileField(model: Model, field: Extract<Field, { type: "file" }>): string {
  const dataPath = displayDataPath(model, field);
  if (field.maxSelect > 1) {
    return dedent`
      <div class="space-y-2">
        <h3 class="font-medium leading-none">${field.title}</h3>
        {#if ${dataPath}}
          {#each ${dataPath} as filename}
            <div class="flex gap-2 items-center">
              {#if [".jpg", ".png", ".jpeg", ".webp", ".gif"].some((ext) => filename.endsWith(ext))}
                <img
                  src="/api/files/{data.${model.name}.collectionId}/{data.${model.name}.id}/{filename}"
                  alt={filename}
                  class="w-16 h-16 rounded-md object-cover"
                />
              {:else}
                <div class="flex items-center justify-center w-16 h-16 bg-muted rounded-md">
                  <FileIcon class="w-4 h-4" />
                </div>
              {/if}
              <p class="text-sm text-muted-foreground">{filename}</p>
            </div>
          {/each}
        {/if}
      </div>
    `;
  }

  return dedent`
    <div class="space-y-2">
      <h3 class="font-medium leading-none">${field.title}</h3>
      {#if ${dataPath}}
        <div class="flex gap-2 items-center">
          {#if [".jpg", ".png", ".jpeg", ".webp", ".gif"].some((ext) => ${dataPath}?.endsWith(ext))}
            <img
              src="/api/files/{data.${model.name}.collectionId}/{data.${model.name}.id}/{${dataPath}}"
              alt={${dataPath}}
              class="w-16 h-16 rounded-md object-cover"
            />
          {:else}
            <div class="flex items-center justify-center w-16 h-16 bg-muted rounded-md">
              <FileIcon class="w-4 h-4" />
            </div>
          {/if}
          <p class="text-sm text-muted-foreground">{${dataPath}}</p>
        </div>
      {/if}
    </div>
  `;
}

function relationListUrl(field: Extract<Field, { type: "relation" }>): string {
  return `/${field.relatedModel.routeSegment}`;
}

function renderDisplayRelationField(
  model: Model,
  field: Extract<Field, { type: "relation" }>,
): string {
  const relationPath = `data.${model.name}.expand?.${field.name}`;
  const listUrl = relationListUrl(field);
  if (field.maxSelect > 1) {
    return dedent`
      <div class="space-y-2">
        <h3 class="font-medium leading-none">${field.title}</h3>
        {#each ${relationPath} ?? [] as ${field.singularRelationName}}
          <a href="${listUrl}/{${field.singularRelationName}.id}">
            <Badge variant="outline" class="text-muted-foreground">
              {${field.singularRelationName}.${field.displayField}}
              <CircleArrowRightIcon class="w-4 h-4" />
            </Badge>
          </a>
        {/each}
      </div>
    `;
  }

  return dedent`
    <div class="space-y-2">
      <h3 class="font-medium leading-none">${field.title}</h3>
      {#if ${relationPath}}
        <a href="${listUrl}/{${relationPath}.id}">
          <Badge variant="outline" class="text-muted-foreground">
            {${relationPath}.${field.displayField}}
            <CircleArrowRightIcon class="w-4 h-4" />
          </Badge>
        </a>
      {/if}
    </div>
  `;
}

function renderDisplayGeoPointField(model: Model, field: Field & { type: "geoPoint" }): string {
  const dataPath = displayDataPath(model, field);
  const content = dedent`
    {#await import("$lib/components/ui/leaflet/leaflet.svelte")}
      <div class="h-56.25 w-full bg-input rounded-md"></div>
    {:then { default: Leaflet }}
      <Leaflet point={${dataPath}} readonly class="rounded-md overflow-hidden" />
    {/await}
    <p class="text-muted-foreground">
      {${dataPath}?.lat.toFixed(6)}, {${dataPath}?.lon.toFixed(6)}
    </p>
  `;
  const body = field.required
    ? content
    : dedent`
      {#if ${dataPath}}
        ${content}
      {/if}
    `;

  return dedent`
    <div class="space-y-2">
      <h3 class="font-medium leading-none">${field.title}</h3>
      ${body}
    </div>
  `;
}

export function renderDisplayField(model: Model, field: Field): string {
  switch (field.type) {
    case "text":
    case "number":
    case "email":
    case "editor":
      return renderDisplaySimple(model, field, `{${displayDataPath(model, field)}}`);
    case "password":
      return dedent`
        <div class="space-y-2">
          <h3 class="font-medium leading-none">${field.title}</h3>
          <p class="text-muted-foreground">
            <code class="text-xs font-mono bg-muted rounded-md px-1 py-0.5">********</code>
          </p>
        </div>
      `;
    case "bool":
      return renderDisplaySimple(
        model,
        field,
        `{${displayDataPath(model, field)} ? "Yes" : "No"}`,
      );
    case "date":
    case "autodate":
      return renderDisplayDateField(model, field as Field & { type: "date" | "autodate" });
    case "url":
      return renderDisplayUrlField(model, field as Field & { type: "url" });
    case "select":
      return renderDisplaySelectField(model, field);
    case "file":
      return renderDisplayFileField(model, field);
    case "json":
      return renderDisplaySimple(model, field, `{JSON.stringify(${displayDataPath(model, field)})}`);
    case "geoPoint":
      return renderDisplayGeoPointField(model, field as Field & { type: "geoPoint" });
    case "relation":
      return renderDisplayRelationField(model, field);
    default: {
      const exhaustiveType: never = field;
      return exhaustiveType;
    }
  }
}
