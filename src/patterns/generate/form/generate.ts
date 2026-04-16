import dedent from "dedent";
import type { Component, File, Options, Result } from "../../../core/types";
import { languageFromPath } from "../../../core/util";
import {
  getFieldComponents,
  getFieldImports,
  renderField,
  selectFieldLabelMap,
} from "../../../core/field";
import {
  parseFields,
  parseModel,
  validateModelName,
  type Collection,
  type Field,
  type Model,
} from "../../../parse";
import { generateFormServerTestSnippet } from "../../../core/tests";

function formPaths(modelPath: string, routesDir: string) {
  const normalizedModelPath = modelPath.replace(/^\/+|\/+$/g, "");
  const basePath = `${routesDir}/${normalizedModelPath}`;
  const baseUrl = `/${normalizedModelPath}`;

  return {
    pagePath: basePath,
    pageUrl: baseUrl,
  };
}

function parsePatternArgs(argv: string[]) {
  const [modelPath, ...fields] = argv;
  if (!modelPath) {
    throw new Error("Invalid command arguments. Expected: <model> <fields...>");
  }
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

function schemaFields(
  fields: Field[],
): Array<{ name: string; schema: string }> {
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
    (field): field is Extract<Field, { type: "select" }> =>
      field.type === "select",
  );
  const labelMaps = selectFields
    .map((field) => selectFieldLabelMap(field))
    .join("\n\n");

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
  const { modelPath, fields: fieldDefs } = parsePatternArgs(options.argv);

  validateModelName(modelPath);
  const model = parseModel(modelPath, options);
  const parsed = await parseFields(fieldDefs, model, options);
  const fields = parsed.fields;
  const { pagePath, pageUrl } = formPaths(modelPath, model.routesDir);
  const collections =
    options.env === "runtime"
      ? ((await (
          await import("../../../parse/env.runtime")
        ).getCollections()) as Collection[])
      : (await import("../../../parse/env.preview")).getPreviewCollections(
          options,
        );

  const creates = [
    toFile(`${pagePath}/+page.svelte`, pageSnippet(model, fields)),
    toFile(`${pagePath}/+page.server.ts`, serverSnippet(model, fields)),
    toFile(
      `${pagePath}/server.test.ts`,
      generateFormServerTestSnippet(
        model,
        pageUrl,
        fields,
        options,
        collections,
      ),
    ),
    toFile(`src/lib/schemas/${model.name}.ts`, generateSchema(model, fields)),
  ];

  const components = getFieldComponents(fields) as Component[];

  return {
    creates,
    modifies: [],
    deletes: [],
    components,
    packages: [],
    collections: [],
  } satisfies Result;
}
