import * as changeCase from "change-case";
import pluralize from "pluralize";
import { InvalidArgumentError } from "../core/errors";
import type { Model } from "./types";

const RESERVED_WORDS = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "let",
  "static",
  "package",
  "protected",
  "private",
  "public",
  "interface",
  "enum",
  "implements",
  "type",
  "namespace",
  "null",
  "true",
  "false",
  "await",
  "async",
  "arguments",
  "constructor",
]);

const RESERVED_ALIASES: Record<string, string> = {
  function: "fn",
  interface: "iface",
  type: "type_",
  enum: "enum_",
  const: "const_",
  let: "let_",
  var: "var_",
  class: "class_",
  default: "default_",
  delete: "delete_",
  new: "new_",
  import: "import_",
  export: "export_",
  extends: "extends_",
  super: "super_",
  return: "return_",
  case: "case_",
  switch: "switch_",
  try: "try_",
  catch: "catch_",
  finally: "finally_",
  do: "do_",
  while: "while_",
  for: "for_",
  if: "if_",
  in: "in_",
  of: "of_",
  with: "with_",
  this: "this_",
  throw: "throw_",
  void: "void_",
  typeof: "typeOf",
  instanceof: "instanceOf",
  yield: "yield_",
  await: "await_",
  async: "async_",
  implements: "implements_",
  package: "package_",
  private: "private_",
  protected: "protected_",
  public: "public_",
  namespace: "namespace_",
  null: "nullValue",
  true: "trueValue",
  false: "falseValue",
  arguments: "args",
  constructor: "ctor",
};

export function safeVarName(str: string): string {
  if (RESERVED_WORDS.has(str)) {
    return RESERVED_ALIASES[str] ?? `${str}_`;
  }
  return str;
}

export function validateModelName(model: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(model)) {
    throw new InvalidArgumentError(
      "Model name must start with a letter and contain only alphanumeric characters, dash, or underscore. Use --route to specify a custom route path.",
    );
  }
}

export function parseModel(modelName: string): Model {
  const displayName = pluralize.singular(changeCase.capitalCase(modelName));
  const pluralDisplay = pluralize.plural(displayName);
  const name = changeCase.camelCase(displayName);

  return {
    name: safeVarName(name),
    pluralName: safeVarName(changeCase.camelCase(pluralDisplay)),
    typeName: changeCase.pascalCase(displayName),
    tableName: changeCase.snakeCase(pluralDisplay),
    displayName,
    pluralDisplayName: pluralDisplay,
    schemaName: `${safeVarName(name)}Schema`,
  };
}
