import dedent from "dedent";
import type { Field } from "../../parse";

export type RemoteFieldComponent = "input" | "textarea" | "button";

const REMOTE_FIELD_COMPONENTS: Record<Field["type"], RemoteFieldComponent[]> = {
  text: ["input"],
  number: ["input"],
  email: ["input"],
  password: ["input"],
  url: ["input"],
  date: ["input"],
  bool: [],
  editor: ["textarea"],
  json: ["textarea"],
  select: [],
  file: [],
  autodate: ["input"],
  geoPoint: [],
  relation: [],
};

const REMOTE_FIELD_IMPORTS: Record<RemoteFieldComponent, string> = {
  input: 'import { Input } from "$lib/components/ui/input";',
  textarea: 'import { Textarea } from "$lib/components/ui/textarea";',
  button: 'import { Button } from "$lib/components/ui/button";',
};

export function getRemoteFieldComponents(
  fields: Field[],
): RemoteFieldComponent[] {
  const components = fields.flatMap(
    (field) => REMOTE_FIELD_COMPONENTS[field.type],
  );
  return [...new Set(components)];
}

export function getRemoteFieldImports(
  components: RemoteFieldComponent[],
): string[] {
  return components.map((component) => REMOTE_FIELD_IMPORTS[component]);
}

interface RemoteRenderOptions {
  formVar: string;
}

function fieldAttrs(formVar: string, field: Field, asType: string): string {
  return `{...${formVar}.fields.${field.name}.as(${JSON.stringify(asType)})}`;
}

function issuesBlock(formVar: string, field: Field): string {
  return dedent`
    {#each ${formVar}.fields.${field.name}.issues() as issue}
      <p class="text-destructive text-sm">{issue.message}</p>
    {/each}
  `;
}

function renderInputFieldRemote(
  field: Field,
  formVar: string,
  asType: "text" | "number",
  typeOverride?: string,
): string {
  const required = field.required ? " required" : "";
  const typeAttr = typeOverride ? ` type="${typeOverride}"` : "";
  return dedent`
    <div class="space-y-2 col-span-1">
      <label for="${field.name}" class="text-sm font-medium">${field.title}</label>
      <Input id="${field.name}" ${fieldAttrs(formVar, field, asType)}${typeAttr}${required} />
      ${issuesBlock(formVar, field)}
    </div>
  `;
}

function renderTextareaFieldRemote(field: Field, formVar: string): string {
  const required = field.required ? " required" : "";
  return dedent`
    <div class="space-y-2 col-span-2">
      <label for="${field.name}" class="text-sm font-medium">${field.title}</label>
      <Textarea id="${field.name}" ${fieldAttrs(formVar, field, "text")}${required} />
      ${issuesBlock(formVar, field)}
    </div>
  `;
}

function renderBoolFieldRemote(field: Field, formVar: string): string {
  const required = field.required ? " required" : "";
  return dedent`
    <div class="col-span-1 flex items-start space-x-2">
      <input id="${field.name}" type="checkbox" ${fieldAttrs(formVar, field, "checkbox")}${required} />
      <label for="${field.name}" class="text-sm font-medium">${field.title}</label>
      ${issuesBlock(formVar, field)}
    </div>
  `;
}

function renderSelectFieldRemote(
  field: Extract<Field, { type: "select" }>,
  formVar: string,
): string {
  const multiple = field.maxSelect > 1 ? " multiple" : "";
  const required = field.required ? " required" : "";
  const options = field.options
    .map(
      (option) =>
        `<option value=${JSON.stringify(option.value)}>${option.label}</option>`,
    )
    .join("\n        ");

  return dedent`
    <div class="space-y-2 col-span-1">
      <label for="${field.name}" class="text-sm font-medium">${field.title}</label>
      <select id="${field.name}" ${fieldAttrs(formVar, field, "select")}${multiple}${required} class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm">
        ${options}
      </select>
      ${issuesBlock(formVar, field)}
    </div>
  `;
}

function renderFileFieldRemote(
  field: Extract<Field, { type: "file" }>,
  formVar: string,
): string {
  const multiple = field.maxSelect > 1 ? " multiple" : "";
  const required = field.required ? " required" : "";
  return dedent`
    <div class="space-y-2 col-span-1">
      <label for="${field.name}" class="text-sm font-medium">${field.title}</label>
      <input id="${field.name}" ${fieldAttrs(formVar, field, "file")}${multiple}${required} class="text-sm" />
      ${issuesBlock(formVar, field)}
    </div>
  `;
}

function renderAutodateFieldRemote(field: Field, formVar: string): string {
  return dedent`
    <div class="space-y-2 col-span-1">
      <label for="${field.name}" class="text-sm font-medium">${field.title}</label>
      <Input id="${field.name}" ${fieldAttrs(formVar, field, "text")} readonly />
    </div>
  `;
}

function renderUnsupportedFieldRemote(field: Field): string {
  return `<!-- TODO: ${field.type} field "${field.name}" is not yet supported by the remote form variant -->`;
}

export function renderRemoteField(
  field: Field,
  options: RemoteRenderOptions,
): string {
  const { formVar } = options;
  switch (field.type) {
    case "text":
      return renderInputFieldRemote(field, formVar, "text");
    case "number":
      return renderInputFieldRemote(field, formVar, "number");
    case "email":
      return renderInputFieldRemote(field, formVar, "text", "email");
    case "password":
      return renderInputFieldRemote(field, formVar, "text", "password");
    case "url":
      return renderInputFieldRemote(field, formVar, "text", "url");
    case "date":
      return renderInputFieldRemote(field, formVar, "text", "date");
    case "editor":
    case "json":
      return renderTextareaFieldRemote(field, formVar);
    case "bool":
      return renderBoolFieldRemote(field, formVar);
    case "select":
      return renderSelectFieldRemote(field, formVar);
    case "file":
      return renderFileFieldRemote(field, formVar);
    case "autodate":
      return renderAutodateFieldRemote(field, formVar);
    case "geoPoint":
    case "relation":
      return renderUnsupportedFieldRemote(field);
    default: {
      const exhaustiveType: never = field;
      return exhaustiveType;
    }
  }
}
