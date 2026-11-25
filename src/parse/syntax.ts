/**
 * The field syntax of `vela generate`, in one table. The parser, its error
 * messages and the `--help` text all read it, so none can drift from the
 * others.
 */

export interface FieldTypeSyntax {
  /** The PocketBase field type, as the parser resolves it. */
  type: string;
  /** Other spellings the parser takes for it. */
  aliases: string[];
  /** One line for `--help`; kept short enough for an 80-column terminal. */
  help: string;
}

export const FIELD_TYPES: FieldTypeSyntax[] = [
  { type: "text", aliases: ["string"], help: "a line of text" },
  {
    type: "number",
    aliases: ["integer", "int", "float", "decimal", "double"],
    help: "a number",
  },
  { type: "bool", aliases: ["boolean"], help: "a checkbox" },
  {
    type: "date",
    aliases: ["datetime", "timestamp"],
    help: "a date",
  },
  { type: "email", aliases: [], help: "an email address" },
  { type: "url", aliases: [], help: "a URL" },
  { type: "password", aliases: [], help: "a password, stored hashed" },
  { type: "editor", aliases: [], help: "rich text (HTML)" },
  { type: "json", aliases: [], help: "any JSON value" },
  { type: "geoPoint", aliases: ["geopoint"], help: "a latitude and longitude" },
  {
    type: "select",
    aliases: [],
    help: "one of a list of options; see select below",
  },
  {
    type: "file",
    aliases: ["files"],
    help: "an upload; a plural field name takes several",
  },
  {
    type: "relation",
    aliases: ["references"],
    help: "a record of the collection the field names",
  },
  {
    type: "autodate",
    aliases: [],
    help: "set by PocketBase; see autodate below",
  },
];

/** Types that are not PocketBase's own: each is a relation the server fills in. */
export const SPECIAL_FIELD_TYPES: FieldTypeSyntax[] = [
  {
    type: "current_user",
    aliases: [],
    help: "the signed-in user, set on create (needs auth)",
  },
  {
    type: "current_team",
    aliases: [],
    help: "the user's active team, set on create (needs teams)",
  },
];

/** A third `name:type:modifier` segment. */
export const FIELD_MODIFIERS = ["unique"] as const;

export type FieldModifier = (typeof FIELD_MODIFIERS)[number];

/** Every alias, to the type it stands for. */
export const TYPE_ALIASES: Record<string, string> = Object.fromEntries(
  FIELD_TYPES.flatMap(({ type, aliases }) =>
    aliases.map((alias) => [alias, type]),
  ),
);

/** What a field name has to look like, and how the error says so. */
export const FIELD_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;
export const FIELD_NAME_RULE =
  "Must start with a letter and contain only letters, digits and underscores";

const WIDTH = 80;

function wrap(text: string, indent: string, first = indent): string[] {
  const lines: string[] = [];
  let line = first;
  for (const word of text.split(" ")) {
    const candidate = line.trim() === "" ? line + word : `${line} ${word}`;
    if (candidate.length > WIDTH && line.trim() !== "") {
      lines.push(line);
      line = indent + word;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}

function typeLines(types: FieldTypeSyntax[]): string[] {
  const column =
    Math.max(
      ...[...FIELD_TYPES, ...SPECIAL_FIELD_TYPES].map(
        ({ type }) => type.length,
      ),
    ) + 1;
  // Two spaces in, the type, and two spaces before its description.
  const indent = " ".repeat(2 + column + 1);
  return types.flatMap(({ type, aliases, help }) => {
    const also = aliases.length > 0 ? ` (also: ${aliases.join(", ")})` : "";
    return wrap(`${help}${also}`, indent, `  ${type.padEnd(column)}`);
  });
}

function section(title: string, body: string[]): string[] {
  return ["", `${title}:`, ...body];
}

function paragraph(text: string): string[] {
  return wrap(text, "  ");
}

/**
 * The field syntax as plain text, wrapped at 80 columns, for the `--help` of
 * every `vela generate` command that takes field definitions.
 */
export const FIELD_SYNTAX_HELP: string = [
  "Fields are written name:type, one argument each:",
  "",
  "  title:text! body:editor state:select(draft,published) author:current_user",
  "",
  ...paragraph(
    "A name starts with a letter and holds letters, digits and underscores. Leave the fields out to use the ones an existing collection has.",
  ).map((line) => line.slice(2)),
  ...section("Types", typeLines(FIELD_TYPES)),
  ...section("Modifiers", [
    "  !        after the type: the field is required       name:text!",
    "  :unique  a third segment: no two records share it    slug:text!:unique",
    ...wrap(
      "An empty value counts as a value: make a unique field required, or only one record can leave it blank.",
      "           ",
    ),
  ]),
  ...section("select", [
    ...paragraph(
      "Options go in parentheses, as value or value:Label. Quote a value or label that holds a comma or a colon, and quote the whole argument for the shell. A plural field name takes several options, a singular one takes one.",
    ),
    "",
    "    state:select(draft,published)",
    "    'size:select(s:Small,m:Medium,l:Large)!'",
    "    tags:select(red,green,blue)",
  ]),
  ...section("Relations", [
    ...paragraph(
      "Name the collection as the type, singular or plural, or use relation (or references) to take the collection from the field name. A plural field name holds several records, a singular one holds one.",
    ),
    "",
    "    owner:user         one record of users, in a field named owner",
    "    members:users      several records of users",
    "    category:relation  one record of categories",
    "    tags:references    several records of tags",
  ]),
  ...section("Set by the server", typeLines(SPECIAL_FIELD_TYPES)),
  "",
  "    author:current_user team:current_team",
  ...section("autodate", [
    ...paragraph(
      'The name says when PocketBase sets it: with "create" in it, when the record is created; with "update", then and on every update. created_at and updatedAt both work. Every new collection gets a created and an updated field of its own.',
    ),
  ]),
].join("\n");
