import dedent from "dedent";
import type { Field } from "../../parse";

/**
 * Native-element field markup, shared by every form flavour that does not go
 * through formsnap. Two things vary independently:
 *
 * - the **binding**: how a control is tied to the form library (superforms
 *   stores, or a SvelteKit remote form's `.as()` / `.issues()`), and
 * - the **style**: shadcn's `Input`/`Textarea` plus tailwind classes, or bare
 *   elements with `data-*` hooks for projects that have neither.
 */

export type ControlKind =
  "input" | "textarea" | "checkbox" | "select" | "file" | "readonly";

export interface ControlOptions {
  /** The `type` attribute of an `<input>`. */
  htmlType?: string;
  multiple?: boolean;
  required?: boolean;
}

export interface PlainBinding {
  /** Attributes tying a control to its field, emitted right after `id`. */
  control(field: Field, kind: ControlKind, options: ControlOptions): string;
  /** Markup listing the field's validation errors. */
  errors(field: Field, errorAttrs: string): string;
  /** Expression that is truthy while the field has errors. */
  invalid(field: Field): string;
  /** Field types the binding has no markup for; they render as a TODO comment. */
  unsupported: Field["type"][];
  /** Name used in the TODO comment of an unsupported field. */
  label: string;
}

type Layout = "default" | "wide" | "inline";

export interface PlainStyle {
  input: string;
  textarea: string;
  wrapper(field: Field, layout: Layout, binding: PlainBinding): string;
  labelAttrs: string;
  selectAttrs: string;
  fileAttrs: string;
  errorAttrs: string;
}

/** shadcn `Input`/`Textarea` and tailwind classes: what the remote generators emit. */
export const SHADCN_STYLE: PlainStyle = {
  input: "Input",
  textarea: "Textarea",
  wrapper(_field, layout) {
    const classes: Record<Layout, string> = {
      default: "space-y-2 col-span-1",
      wide: "space-y-2 col-span-2",
      inline: "col-span-1 flex items-start space-x-2",
    };
    return ` class="${classes[layout]}"`;
  },
  labelAttrs: ' class="text-sm font-medium"',
  selectAttrs:
    ' class="border-input bg-background flex h-9 w-full rounded-md border px-3 py-1 text-sm"',
  fileAttrs: ' class="text-sm"',
  errorAttrs: ' class="text-destructive text-sm"',
};

/**
 * No components and no classes. `data-field` / `data-invalid` / `data-error`
 * let a project style every generated form from one stylesheet.
 */
export const NATIVE_STYLE: PlainStyle = {
  input: "input",
  textarea: "textarea",
  wrapper(field, _layout, binding) {
    return ` data-field="${field.name}" data-invalid={${binding.invalid(field)} ? "" : undefined}`;
  },
  labelAttrs: "",
  selectAttrs: "",
  fileAttrs: "",
  errorAttrs: " data-error",
};

export function isMultiple(field: Field): boolean {
  return (
    (field.type === "select" ||
      field.type === "relation" ||
      field.type === "file") &&
    field.maxSelect > 1
  );
}

const flag = (on: boolean | undefined, attr: string) => (on ? ` ${attr}` : "");

export function remoteBinding(formVar: string): PlainBinding {
  const as = (field: Field, type: string) =>
    `{...${formVar}.fields.${field.name}.as(${JSON.stringify(type)})}`;

  return {
    label: "remote form variant",
    unsupported: ["geoPoint", "relation"],
    control(field, kind, { htmlType, multiple, required }) {
      const tail = `${flag(multiple, "multiple")}${flag(required, "required")}`;
      switch (kind) {
        case "input": {
          const asType = htmlType === "number" ? "number" : "text";
          const type =
            htmlType && htmlType !== "text" && htmlType !== "number"
              ? ` type="${htmlType}"`
              : "";
          return `${as(field, asType)}${type}${tail}`;
        }
        case "textarea":
          return `${as(field, "text")}${tail}`;
        case "checkbox":
          // `.as("checkbox")` sets `type` itself; a literal one is a duplicate attribute.
          return `${as(field, "checkbox")}${tail}`;
        case "select":
          return `${as(field, "select")}${tail}`;
        case "file":
          return `${as(field, "file")}${tail}`;
        case "readonly":
          return `${as(field, "text")} readonly`;
      }
    },
    errors(field, errorAttrs) {
      return dedent`
        {#each ${formVar}.fields.${field.name}.issues() as issue}
          <p${errorAttrs}>{issue.message}</p>
        {/each}
      `;
    },
    invalid(field) {
      return `${formVar}.fields.${field.name}.issues()?.length`;
    },
  };
}

/** Array-valued fields report their own errors under `_errors`. */
function superformsErrors(field: Field): string {
  return isMultiple(field)
    ? `$errors.${field.name}?._errors`
    : `$errors.${field.name}`;
}

/** Controls that take superforms' `$constraints` instead of a literal `required`. */
const CONSTRAINED: ControlKind[] = ["input", "textarea"];

export function usesConstraints(fields: Field[]): boolean {
  return fields.some((field) =>
    [
      "text",
      "number",
      "email",
      "password",
      "url",
      "date",
      "editor",
      "json",
    ].includes(field.type),
  );
}

export function superformsBinding(): PlainBinding {
  return {
    label: "plain form variant",
    unsupported: [],
    control(field, kind, { htmlType, multiple, required }) {
      const value = `$formData.${field.name}`;
      const errors = superformsErrors(field);
      const aria = ` aria-invalid={${errors} ? "true" : undefined} aria-describedby={${errors} ? "${field.name}-error" : undefined}`;
      const tail = CONSTRAINED.includes(kind)
        ? ` {...$constraints.${field.name}}`
        : `${flag(multiple, "multiple")}${flag(required, "required")}`;

      switch (kind) {
        case "input":
          return `name="${field.name}" type="${htmlType ?? "text"}" bind:value={${value}}${aria}${tail}`;
        case "textarea":
        case "select":
          return `name="${field.name}" bind:value={${value}}${aria}${tail}`;
        case "checkbox":
          return `name="${field.name}" type="checkbox" bind:checked={${value}}${aria}${tail}`;
        case "file":
          // Multi-file fields follow PocketBase's `name+` (append) convention;
          // the schema carries a matching `name+` key.
          return multiple
            ? `name="${field.name}+" type="file" oninput={(e) => ($formData["${field.name}+"] = Array.from(e.currentTarget.files ?? []))}${aria}${tail}`
            : `name="${field.name}" type="file" oninput={(e) => (${value} = e.currentTarget.files?.[0] ?? "")}${aria}${tail}`;
        case "readonly":
          return `name="${field.name}" type="text" value={${value}} readonly`;
      }
    },
    errors(field, errorAttrs) {
      const errors = superformsErrors(field);
      return dedent`
        {#if ${errors}}
          <p id="${field.name}-error"${errorAttrs}>{${errors}}</p>
        {/if}
      `;
    },
    invalid: superformsErrors,
  };
}

export interface PlainRenderer {
  render(field: Field): string;
}

export function plainRenderer(
  binding: PlainBinding,
  style: PlainStyle,
): PlainRenderer {
  const label = (field: Field, htmlFor = field.name) =>
    `<label for="${htmlFor}"${style.labelAttrs}>${field.title}</label>`;

  function input(field: Field, htmlType: string): string {
    return dedent`
      <div${style.wrapper(field, "default", binding)}>
        ${label(field)}
        <${style.input} id="${field.name}" ${binding.control(field, "input", { htmlType, required: field.required })} />
        ${binding.errors(field, style.errorAttrs)}
      </div>
    `;
  }

  function textarea(field: Field): string {
    const tag = style.textarea;
    const control = binding.control(field, "textarea", {
      required: field.required,
    });
    const element =
      tag === "textarea"
        ? `<textarea id="${field.name}" ${control}></textarea>`
        : `<${tag} id="${field.name}" ${control} />`;
    return dedent`
      <div${style.wrapper(field, "wide", binding)}>
        ${label(field)}
        ${element}
        ${binding.errors(field, style.errorAttrs)}
      </div>
    `;
  }

  function checkbox(field: Field): string {
    return dedent`
      <div${style.wrapper(field, "inline", binding)}>
        <input id="${field.name}" ${binding.control(field, "checkbox", { required: field.required })} />
        ${label(field)}
        ${binding.errors(field, style.errorAttrs)}
      </div>
    `;
  }

  function select(field: Extract<Field, { type: "select" }>): string {
    const options = field.options
      .map(
        (option) =>
          `<option value=${JSON.stringify(option.value)}>${option.label}</option>`,
      )
      .join("\n        ");

    return dedent`
      <div${style.wrapper(field, "default", binding)}>
        ${label(field)}
        <select id="${field.name}" ${binding.control(field, "select", { multiple: isMultiple(field), required: field.required })}${style.selectAttrs}>
          ${options}
        </select>
        ${binding.errors(field, style.errorAttrs)}
      </div>
    `;
  }

  function relation(field: Extract<Field, { type: "relation" }>): string {
    const multiple = isMultiple(field);
    const modelName = field.relatedModel.name;
    const placeholder = multiple
      ? ""
      : `<option value="">Select ${field.relatedModel.displayName.toLowerCase()}</option>`;

    return dedent`
      <div${style.wrapper(field, "default", binding)}>
        ${label(field)}
        <select id="${field.name}" ${binding.control(field, "select", { multiple, required: field.required })}${style.selectAttrs}>
          ${placeholder}
          {#each data.${field.relatedModel.pluralName} as ${modelName}}
            <option value={${modelName}.id}>{${modelName}.${field.displayField}}</option>
          {/each}
        </select>
        ${binding.errors(field, style.errorAttrs)}
      </div>
    `;
  }

  function file(field: Extract<Field, { type: "file" }>): string {
    return dedent`
      <div${style.wrapper(field, "default", binding)}>
        ${label(field)}
        <input id="${field.name}" ${binding.control(field, "file", { multiple: isMultiple(field), required: field.required })}${style.fileAttrs} />
        ${binding.errors(field, style.errorAttrs)}
      </div>
    `;
  }

  function autodate(field: Field): string {
    return dedent`
      <div${style.wrapper(field, "default", binding)}>
        ${label(field)}
        <${style.input} id="${field.name}" ${binding.control(field, "readonly", {})} />
      </div>
    `;
  }

  /**
   * PocketBase takes a geoPoint as `{ lat, lon }`; the form schema carries it
   * as a JSON string, kept in sync from `<name>Point` (see `geoPointState`).
   */
  function geoPoint(field: Field): string {
    const point = `${field.name}Point`;
    return dedent`
      <fieldset${style.wrapper(field, "default", binding)}>
        <legend>${field.title}</legend>
        <label for="${field.name}-lat"${style.labelAttrs}>Latitude</label>
        <${style.input} id="${field.name}-lat" type="number" step="any" min="-90" max="90" bind:value={${point}.lat} />
        <label for="${field.name}-lon"${style.labelAttrs}>Longitude</label>
        <${style.input} id="${field.name}-lon" type="number" step="any" min="-180" max="180" bind:value={${point}.lon} />
        <input type="hidden" name="${field.name}" value={$formData.${field.name}} />
        ${binding.errors(field, style.errorAttrs)}
      </fieldset>
    `;
  }

  return {
    render(field) {
      if (binding.unsupported.includes(field.type)) {
        return `<!-- TODO: ${field.type} field "${field.name}" is not yet supported by the ${binding.label} -->`;
      }

      switch (field.type) {
        case "text":
        case "number":
        case "email":
        case "password":
        case "url":
        case "date":
          return input(field, field.type);
        case "editor":
        case "json":
          return textarea(field);
        case "bool":
          return checkbox(field);
        case "select":
          return select(field);
        case "relation":
          return relation(field);
        case "file":
          return file(field);
        case "autodate":
          return autodate(field);
        case "geoPoint":
          return geoPoint(field);
        default: {
          const exhaustiveType: never = field;
          return exhaustiveType;
        }
      }
    },
  };
}

/** Script-side state backing the lat/lon inputs of each geoPoint field. */
export function geoPointState(fields: Field[]): string {
  return fields
    .filter((field) => field.type === "geoPoint")
    .map(
      (field) => dedent`
        let ${field.name}Point = $state<{ lat: number; lon: number }>(
          JSON.parse($formData.${field.name} || '{"lat":0,"lon":0}'),
        );
        $effect(() => {
          $formData.${field.name} = JSON.stringify(${field.name}Point);
        });
      `,
    )
    .join("\n\n");
}
