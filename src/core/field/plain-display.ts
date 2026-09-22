import dedent from "dedent";
import type { Field } from "../../parse";

/**
 * Native markup showing one field of a record, for pages without
 * shadcn-svelte: a list page's table cell and a detail page's `<dd>`.
 * `record` is the expression the record is in (`contact`, `data.contact`).
 *
 * Select fields read the `<name>Labels` map the page declares (see
 * `selectFieldLabelMap`); relations read the record's `expand`, so the load
 * has to expand them.
 */
export function renderPlainValue(field: Field, record: string): string {
  const value = `${record}.${field.name}`;

  switch (field.type) {
    case "text":
    case "number":
    case "email":
    case "editor":
      return `{${value}}`;
    case "password":
      return "********";
    case "bool":
      return `{${value} ? "Yes" : "No"}`;
    case "date":
    case "autodate":
      return `{${value} ? new Date(${value}).toLocaleDateString() : ""}`;
    case "url":
      return dedent`
        {#if ${value}}
          <a href={${value}}>{${value}}</a>
        {/if}
      `;
    case "json":
      return `{JSON.stringify(${value})}`;
    case "geoPoint":
      return dedent`
        {#if ${value}}
          {${value}.lat.toFixed(6)}, {${value}.lon.toFixed(6)}
        {/if}
      `;
    case "select":
      return field.maxSelect > 1
        ? `{${value}?.map((option) => ${field.name}Labels[option].label).join(", ")}`
        : `{${value} ? ${field.name}Labels[${value}].label : ""}`;
    case "relation": {
      const expanded = `${record}.expand?.${field.name}`;
      return field.maxSelect > 1
        ? `{${expanded}?.map((${field.singularRelationName}) => ${field.singularRelationName}.${field.displayField}).join(", ")}`
        : `{${expanded}?.${field.displayField}}`;
    }
    case "file": {
      const href = (filename: string) =>
        `/api/files/{${record}.collectionId}/{${record}.id}/{${filename}}`;
      return field.maxSelect > 1
        ? dedent`
          {#each ${value} ?? [] as filename (filename)}
            <a href="${href("filename")}">{filename}</a>
          {/each}
        `
        : dedent`
          {#if ${value}}
            <a href="${href(value)}">{${value}}</a>
          {/if}
        `;
    }
    default: {
      const exhaustiveType: never = field;
      return exhaustiveType;
    }
  }
}
